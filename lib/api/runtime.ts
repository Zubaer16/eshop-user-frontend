export type ApiUser = {
  id: string
  email: string
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN' | 'STAFF'
  staffRole: string | null
  permissions: string[]
}
export type Session = {
  status: 'anonymous' | 'checking' | 'authenticated'
  user: ApiUser | null
  epoch: number
  notice: string
}
type Pair = {
  accessToken: string
  refreshToken: string | null
  tokenType: string
  expiresIn: number
  user: ApiUser
}
export type PersistentSession = {
  exchange: (
    action: 'login' | 'register' | 'refresh' | 'logout',
    credentials?: { email: string; password: string },
  ) => Promise<unknown>
}
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  auth?: boolean
  refreshOn401?: boolean
}
export class ApiRequestError extends Error {
  status: number
  retryAfterSeconds: number | null
  constructor(
    status: number,
    message: string,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}
export function apiOrigin(
  value: string | undefined,
  production = false,
): string {
  if (!value)
    throw new ApiRequestError(
      503,
      'This service is not configured. Please contact support.',
    )
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ApiRequestError(503, 'Invalid service configuration.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (production && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  )
    throw new ApiRequestError(503, 'Invalid service configuration.')
  return url.origin
}
export function safeReturnTo(value: string | null, fallback: string): string {
  if (!value || value.length > 2048) return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (
      ![value, decoded].every(
        (v) =>
          v.startsWith('/') &&
          !v.startsWith('//') &&
          !v.includes('\\') &&
          !/[\u0000-\u0020\u007f]/.test(v),
      )
    )
      return fallback
    const url = new URL(value, 'https://return.invalid')
    if (
      url.origin !== 'https://return.invalid' ||
      /^\/(sign-in|sign-up|forgot-password|reset-password|verify-email)(\/|$)/.test(
        url.pathname,
      )
    )
      return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
function readUser(value: unknown): ApiUser {
  const u = value as Partial<ApiUser> | null
  if (
    !u ||
    typeof u.id !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      u.id,
    ) ||
    typeof u.email !== 'string' ||
    !['CUSTOMER', 'OWNER', 'ADMIN', 'STAFF'].includes(u.role || '')
  )
    throw new ApiRequestError(502, 'The service returned an invalid identity.')
  return {
    id: u.id,
    email: u.email,
    role: u.role!,
    staffRole: typeof u.staffRole === 'string' ? u.staffRole : null,
    permissions: Array.isArray(u.permissions)
      ? [
          ...new Set(
            u.permissions.filter((p): p is string => typeof p === 'string'),
          ),
        ]
      : [],
  }
}
function readPair(value: unknown, persistent = false): Pair {
  const p = value as Partial<Pair> | null
  if (
    !p ||
    typeof p.accessToken !== 'string' ||
    p.accessToken.length < 20 ||
    (persistent
      ? p.refreshToken != null
      : typeof p.refreshToken !== 'string' || p.refreshToken.length < 20) ||
    p.tokenType !== 'Bearer' ||
    !Number.isInteger(p.expiresIn) ||
    p.expiresIn! <= 0 ||
    p.expiresIn! > 86400
  )
    throw new ApiRequestError(502, 'The service returned an invalid session.')
  return {
    accessToken: p.accessToken,
    refreshToken: p.refreshToken ?? null,
    tokenType: 'Bearer',
    expiresIn: p.expiresIn!,
    user: readUser(p.user),
  }
}
export function createApiClient(config: {
  audience: 'customer' | 'staff'
  baseUrl: () => string
  fetch?: typeof fetch
  now?: () => number
  timeoutMs?: number
  session?: PersistentSession
  onLogout?: () => void
  onLogin?: () => void
}) {
  const send =
    config.fetch || ((...args: Parameters<typeof fetch>) => fetch(...args))
  const now = config.now || Date.now
  let epoch = 0
  let externalEpoch = -1
  let tokens: {
    access: string
    refresh: string | null
    expiresAt: number
  } | null = null
  let snapshot: Session = { status: 'anonymous', user: null, epoch, notice: '' }
  const serverSnapshot = snapshot
  const listeners = new Set<() => void>()
  const pending = new Set<AbortController>()
  let refreshing: { epoch: number; promise: Promise<void> } | null = null
  let restoring: Promise<void> | null = null
  const allowed = (user: ApiUser) =>
    config.audience === 'customer'
      ? user.role === 'CUSTOMER'
      : user.role !== 'CUSTOMER'
  function publish(
    status: Session['status'],
    user: ApiUser | null,
    notice = '',
  ) {
    snapshot = { status, user, epoch, notice }
    listeners.forEach((fn) => fn())
  }
  function invalidate(notice: string) {
    epoch++
    tokens = null
    for (const controller of pending) controller.abort()
    pending.clear()
    publish('anonymous', null, notice)
  }
  function sameSession(ticket: number) {
    if (ticket !== epoch)
      throw new ApiRequestError(499, 'The session changed. Please try again.')
  }
  async function raw<T>(
    route: string,
    options: RequestOptions = {},
    access?: string,
    track = true,
  ): Promise<T> {
    if (!/^\/v1(?:\/[a-zA-Z0-9_-]+)+$/.test(route))
      throw new ApiRequestError(400, 'Invalid API path.')
    const url = new URL(config.baseUrl() + route)
    for (const [key, value] of Object.entries(options.query || {}))
      if (value !== undefined) url.searchParams.set(key, String(value))
    const controller = new AbortController()
    if (options.signal?.aborted)
      throw new ApiRequestError(499, 'Request cancelled.')
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, config.timeoutMs || 15000)
    if (track) pending.add(controller)
    try {
      const response = await send(url.toString(), {
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(access ? { Authorization: 'Bearer ' + access } : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        redirect: 'error',
      })
      if (!response.ok) {
        let message =
          response.status >= 500
            ? 'The service is temporarily unavailable. Please try again.'
            : response.status === 401
              ? 'Your session or credentials are not valid.'
              : response.status === 403
                ? 'You do not have permission for this action.'
                : 'The request could not be completed.'
        if ([400, 409, 422].includes(response.status)) {
          const body = await response.json().catch(() => null)
          const messages = Array.isArray(body?.message)
            ? body.message
            : [body?.message]
          const safe = messages
            .filter((m: unknown): m is string => typeof m === 'string')
            .slice(0, 6)
            .map((m: string) => m.replace(/[\u0000-\u001f]/g, '').slice(0, 240))
          if (safe.length) message = safe.join(' ')
        }
        const retry = response.headers.get('retry-after')
        const seconds =
          retry && /^\d+$/.test(retry) ? Math.min(Number(retry), 3600) : null
        if (response.status === 429)
          message = 'Too many attempts. Please wait before trying again.'
        throw new ApiRequestError(response.status, message, seconds)
      }
      if (response.status === 204) return undefined as T
      try {
        return (await response.json()) as T
      } catch {
        throw new ApiRequestError(
          502,
          'The service returned an invalid response.',
        )
      }
    } catch (error) {
      if (error instanceof ApiRequestError) throw error
      if (timedOut)
        throw new ApiRequestError(
          408,
          'The request timed out. Check the result before retrying an action.',
        )
      if (controller.signal.aborted)
        throw new ApiRequestError(499, 'Request cancelled.')
      throw new ApiRequestError(
        0,
        'Could not reach the service. Check your connection.',
      )
    } finally {
      clearTimeout(timer)
      pending.delete(controller)
      options.signal?.removeEventListener('abort', abort)
    }
  }
  async function revoke(refreshToken: string | null): Promise<boolean> {
    try {
      if (config.session) await config.session.exchange('logout')
      else if (refreshToken)
        await raw(
          '/v1/auth/logout',
          { method: 'POST', body: { refreshToken }, auth: false },
          undefined,
          false,
        )
      return true
    } catch {
      return false
    }
  }
  async function revokeLate(refreshToken: string | null, ticket: number) {
    if (!config.session || ticket > externalEpoch) await revoke(refreshToken)
  }
  const sessionPair = (value: unknown) =>
    readPair(value, Boolean(config.session))
  async function refresh(): Promise<void> {
    if (!tokens) throw new ApiRequestError(401, 'Please sign in to continue.')
    if (refreshing?.epoch === epoch) return refreshing.promise
    const ticket = epoch,
      previous = tokens.refresh,
      subject = snapshot.user?.id
    const promise = (async () => {
      try {
        const pair = sessionPair(
          config.session
            ? await config.session.exchange('refresh')
            : await raw(
                '/v1/auth/refresh',
                {
                  method: 'POST',
                  body: { refreshToken: previous },
                  auth: false,
                },
                undefined,
                false,
              ),
        )
        if (ticket !== epoch) {
          await revokeLate(pair.refreshToken, ticket)
          sameSession(ticket)
        }
        if (!allowed(pair.user) || (subject && pair.user.id !== subject)) {
          await revoke(pair.refreshToken)
          throw new ApiRequestError(
            403,
            'This account cannot use this application.',
          )
        }
        tokens = {
          access: pair.accessToken,
          refresh: pair.refreshToken,
          expiresAt: now() + pair.expiresIn * 1000,
        }
        publish(snapshot.status, pair.user)
      } catch (error) {
        if (ticket === epoch)
          invalidate('Your session ended. Please sign in again.')
        throw error
      }
    })()
    refreshing = { epoch: ticket, promise }
    try {
      await promise
    } finally {
      if (refreshing?.promise === promise) refreshing = null
    }
  }
  async function request<T>(
    route: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (options.auth === false) return raw<T>(route, options, undefined, false)
    const ticket = epoch
    if (!tokens) throw new ApiRequestError(401, 'Please sign in to continue.')
    if (tokens.expiresAt <= now() + 15000) await refresh()
    sameSession(ticket)
    const used = tokens!.access
    try {
      const data = await raw<T>(route, options, used)
      sameSession(ticket)
      return data
    } catch (error) {
      sameSession(ticket)
      if (
        !(error instanceof ApiRequestError) ||
        error.status !== 401 ||
        options.refreshOn401 === false
      )
        throw error
      if (tokens?.access === used) await refresh()
      sameSession(ticket)
      if ((options.method || 'GET') !== 'GET')
        throw new ApiRequestError(
          401,
          'Your session was renewed. Review the result before trying this action again.',
        )
      try {
        const data = await raw<T>(route, options, tokens!.access)
        sameSession(ticket)
        return data
      } catch (retryError) {
        if (
          ticket === epoch &&
          retryError instanceof ApiRequestError &&
          retryError.status === 401
        )
          invalidate('Your session ended. Please sign in again.')
        throw retryError
      }
    }
  }
  async function refreshIdentity() {
    if (!tokens) return
    const ticket = epoch
    const user = readUser(
      await request(
        config.audience === 'customer' ? '/v1/auth/me' : '/v1/admin/auth/me',
      ),
    )
    sameSession(ticket)
    if (!allowed(user) || (snapshot.user && user.id !== snapshot.user.id)) {
      await signOut()
      throw new ApiRequestError(
        403,
        'This account cannot use this application.',
      )
    }
    if (
      snapshot.status !== 'authenticated' ||
      JSON.stringify(user) !== JSON.stringify(snapshot.user)
    )
      publish('authenticated', user)
  }
  function restoreSession(): Promise<void> {
    if (!config.session || tokens) return Promise.resolve()
    if (restoring) return restoring
    const ticket = epoch
    publish('checking', null)
    restoring = (async () => {
      try {
        const pair = sessionPair(await config.session!.exchange('refresh'))
        if (ticket !== epoch) {
          await revokeLate(pair.refreshToken, ticket)
          sameSession(ticket)
        }
        if (!allowed(pair.user)) {
          await revoke(pair.refreshToken)
          throw new ApiRequestError(
            403,
            'This account cannot use this application.',
          )
        }
        tokens = {
          access: pair.accessToken,
          refresh: pair.refreshToken,
          expiresAt: now() + pair.expiresIn * 1000,
        }
        publish('checking', pair.user)
        await refreshIdentity()
      } catch (error) {
        if (ticket === epoch)
          invalidate(
            error instanceof ApiRequestError && error.status === 401
              ? ''
              : 'Could not restore your session. Please try signing in again.',
          )
      }
    })().finally(() => {
      restoring = null
    })
    return restoring
  }
  async function signIn(
    credentials: { email: string; password: string },
    register = false,
  ) {
    const previous = tokens?.refresh,
      flight = refreshing?.promise || restoring
    invalidate('')
    const ticket = epoch
    publish('checking', null)
    let issued: Pair | null = null
    try {
      if (flight) await flight.catch(() => undefined)
      if (previous || config.session) await revoke(previous ?? null)
      sameSession(ticket)
      const route = register
        ? '/v1/auth/register'
        : config.audience === 'customer'
          ? '/v1/auth/login'
          : '/v1/admin/auth/login'
      if (register && config.audience !== 'customer')
        throw new ApiRequestError(403, 'Staff registration is not public.')
      issued = sessionPair(
        config.session
          ? await config.session.exchange(
              register ? 'register' : 'login',
              credentials,
            )
          : await raw(
              route,
              { method: 'POST', body: credentials, auth: false },
              undefined,
              false,
            ),
      )
      if (ticket !== epoch) {
        await revokeLate(issued.refreshToken, ticket)
        sameSession(ticket)
      }
      if (!allowed(issued.user))
        throw new ApiRequestError(
          403,
          'This account cannot use this application.',
        )
      tokens = {
        access: issued.accessToken,
        refresh: issued.refreshToken,
        expiresAt: now() + issued.expiresIn * 1000,
      }
      publish('checking', issued.user)
      await refreshIdentity()
      config.onLogin?.()
    } catch (error) {
      if (issued) await revokeLate(issued.refreshToken, ticket)
      if (ticket === epoch) invalidate('')
      throw error
    }
  }
  async function signOut() {
    const previous = tokens?.refresh,
      flight = refreshing?.promise || restoring
    invalidate('Signed out on this device.')
    config.onLogout?.()
    if (flight) await flight.catch(() => undefined)
    const confirmed =
      previous || config.session ? await revoke(previous ?? null) : true
    if (!confirmed && snapshot.status === 'anonymous')
      publish(
        'anonymous',
        null,
        'Signed out on this device. Server revocation could not be confirmed.',
      )
    return confirmed
  }
  return {
    request,
    signIn,
    signOut,
    refreshIdentity,
    restoreSession,
    clearLocalSession: () => {
      externalEpoch = epoch
      invalidate('Signed out on this device.')
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    can: (permission: string) =>
      snapshot.status === 'authenticated' &&
      (snapshot.user?.role === 'OWNER' ||
        snapshot.user?.permissions.includes(permission) === true),
  }
}
