import { createHash } from 'node:crypto'

type Audience = 'customer' | 'staff'
type TokenPair = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: {
    id: string
    email: string
    role: string
    staffRole?: string | null
    permissions?: string[]
  }
}
class SessionError extends Error {
  status: number
  retryAfter: string | null
  constructor(
    status: number,
    message: string,
    retryAfter: string | null = null,
  ) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

// Imported only by a Node Route Handler. The browser never receives refresh tokens.
export function createSessionHandler(config: {
  audience: Audience
  apiOrigin: () => string
  production: boolean
  appOrigin: () => string | undefined
  fetch?: typeof fetch
}) {
  const send = config.fetch || fetch
  const cookieName =
    (config.production ? '__Host-' : '') +
    (config.audience === 'customer'
      ? 'eshop-user-session'
      : 'eshop-admin-session')
  const refreshes = new Map<string, Promise<TokenPair>>()
  const allowed = (pair: TokenPair) =>
    config.audience === 'customer'
      ? pair.user.role === 'CUSTOMER'
      : ['OWNER', 'ADMIN', 'STAFF'].includes(pair.user.role)
  const cookie = (token: string, age: number) =>
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.production ? '; Secure' : ''}`
  function response(
    body: unknown,
    status: number,
    token?: string,
    retryAfter?: string | null,
  ) {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      Vary: 'Cookie, Origin',
      'X-Content-Type-Options': 'nosniff',
    })
    if (token !== undefined)
      headers.set('Set-Cookie', cookie(token, token ? 30 * 86400 : 0))
    if (retryAfter && /^\d{1,6}$/.test(retryAfter))
      headers.set('Retry-After', retryAfter)
    return new Response(JSON.stringify(body), { status, headers })
  }
  async function upstream(route: string, body: unknown) {
    let result: Response
    try {
      result = await send(config.apiOrigin() + route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      })
    } catch {
      throw new SessionError(
        503,
        'The sign-in service is temporarily unavailable.',
      )
    }
    if (!result.ok)
      throw new SessionError(
        result.status,
        result.status === 429
          ? 'Too many attempts. Please wait before trying again.'
          : result.status === 401 || result.status === 403
            ? 'Your session or credentials are not valid.'
            : result.status === 409
              ? 'This account could not be created. Try signing in.'
              : result.status >= 500
                ? 'The sign-in service is temporarily unavailable.'
                : 'Check your email and password and try again.',
        result.headers.get('retry-after'),
      )
    try {
      return await result.json()
    } catch {
      throw new SessionError(502, 'Invalid sign-in service response.')
    }
  }
  function pair(value: unknown): TokenPair {
    const p = value as TokenPair | null
    if (
      !p ||
      typeof p.accessToken !== 'string' ||
      p.accessToken.length < 20 ||
      typeof p.refreshToken !== 'string' ||
      !/^[A-Za-z0-9_-]{40,128}$/.test(p.refreshToken) ||
      p.tokenType !== 'Bearer' ||
      !Number.isInteger(p.expiresIn) ||
      p.expiresIn <= 0 ||
      p.expiresIn > 86400 ||
      !p.user ||
      typeof p.user.id !== 'string' ||
      typeof p.user.email !== 'string'
    )
      throw new SessionError(502, 'Invalid sign-in service response.')
    return p
  }
  async function revoke(token: string) {
    if (token) await upstream('/v1/auth/logout', { refreshToken: token })
  }
  async function readBody(request: Request) {
    const reader = request.body?.getReader()
    if (!reader) throw new SessionError(400, 'Invalid request.')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 4096) {
          await reader.cancel()
          throw new SessionError(413, 'Request too large.')
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid body')
      return data as Record<string, unknown>
    } catch (error) {
      if (error instanceof SessionError) throw error
      throw new SessionError(400, 'Invalid request.')
    } finally {
      reader.releaseLock()
    }
  }
  return async function handle(request: Request): Promise<Response> {
    let action: unknown,
      existing = ''
    try {
      if (request.method !== 'POST')
        return response({ message: 'Method not allowed.' }, 405)
      const configured = config.appOrigin()
      if (config.production && !configured)
        throw new SessionError(503, 'Application origin is not configured.')
      const origin = new URL(configured || request.url).origin
      if (
        (config.production && !origin.startsWith('https://')) ||
        request.headers.get('origin') !== origin ||
        request.headers.get('sec-fetch-site') === 'cross-site' ||
        request.headers.get('x-eshop-session') !== '1'
      )
        throw new SessionError(403, 'Request origin is not allowed.')
      if (
        request.headers.get('content-type')?.split(';')[0].trim() !==
        'application/json'
      )
        throw new SessionError(415, 'JSON is required.')
      const body = await readBody(request)
      action = body.action
      if (!['login', 'register', 'refresh', 'logout'].includes(String(action)))
        throw new SessionError(400, 'Invalid session action.')
      if (
        Object.keys(body).some(
          (key) =>
            ![
              'action',
              ...(action === 'login' || action === 'register'
                ? ['email', 'password']
                : []),
            ].includes(key),
        )
      )
        throw new SessionError(400, 'Invalid request fields.')
      const values = (request.headers.get('cookie') || '')
        .split(';')
        .map((value) => value.trim())
        .filter((value) => value.startsWith(cookieName + '='))
      if (values.length === 1) {
        const candidate = values[0].slice(cookieName.length + 1)
        if (/^[A-Za-z0-9_-]{40,128}$/.test(candidate)) existing = candidate
      }
      if (action === 'logout') {
        try {
          await revoke(existing)
          return response({ loggedOut: true }, 200, '')
        } catch {
          return response(
            {
              message:
                'Signed out on this device. Server revocation could not be confirmed.',
            },
            503,
            '',
          )
        }
      }
      let issued: TokenPair
      if (action === 'refresh') {
        if (!existing) return response({ message: 'Please sign in.' }, 401, '')
        const key = createHash('sha256').update(existing).digest('hex')
        let flight = refreshes.get(key)
        if (!flight) {
          if (refreshes.size >= 256)
            throw new SessionError(503, 'Please try again shortly.')
          flight = upstream('/v1/auth/refresh', {
            refreshToken: existing,
          }).then(pair)
          refreshes.set(key, flight)
          void flight.then(
            () => refreshes.delete(key),
            () => refreshes.delete(key),
          )
        }
        issued = await flight
      } else {
        if (action === 'register' && config.audience !== 'customer')
          throw new SessionError(403, 'Staff registration is not public.')
        if (
          typeof body.email !== 'string' ||
          body.email.length > 320 ||
          typeof body.password !== 'string' ||
          body.password.length < 12 ||
          body.password.length > 128
        )
          throw new SessionError(
            400,
            'Check your email and password and try again.',
          )
        await revoke(existing)
        issued = pair(
          await upstream(
            action === 'register'
              ? '/v1/auth/register'
              : config.audience === 'customer'
                ? '/v1/auth/login'
                : '/v1/admin/auth/login',
            { email: body.email.trim(), password: body.password },
          ),
        )
      }
      if (!allowed(issued)) {
        await revoke(issued.refreshToken)
        throw new SessionError(403, 'This account cannot use this application.')
      }
      const u = issued.user
      return response(
        {
          accessToken: issued.accessToken,
          tokenType: 'Bearer',
          expiresIn: issued.expiresIn,
          user: {
            id: u.id,
            email: u.email,
            role: u.role,
            staffRole: typeof u.staffRole === 'string' ? u.staffRole : null,
            permissions: Array.isArray(u.permissions)
              ? u.permissions.filter((p) => typeof p === 'string')
              : [],
          },
        },
        200,
        issued.refreshToken,
      )
    } catch (error) {
      const failure =
        error instanceof SessionError
          ? error
          : new SessionError(
              503,
              'The sign-in service is temporarily unavailable.',
            )
      return response(
        { message: failure.message },
        failure.status,
        (failure.status === 401 || failure.status === 403) &&
          (action === 'refresh' || action === 'login' || action === 'register')
          ? ''
          : undefined,
        failure.retryAfter,
      )
    }
  }
}
