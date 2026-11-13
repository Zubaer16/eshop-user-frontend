type Config = {
  apiOrigin: () => string
  appOrigin: () => string | undefined
  production: boolean
  restoreSession: (request: Request) => Promise<Response>
  fetch?: typeof fetch
  now?: () => number
}
class CartError extends Error {
  status: number
  code: string
  retry: string | null
  constructor(
    status: number,
    message: string,
    code = 'CART_REQUEST_FAILED',
    retry: string | null = null,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.retry = retry
  }
}
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
function quote(value: unknown) {
  const q = value as Record<string, unknown>
  if (!q || !Array.isArray(q.items) || q.items.length > 50)
    throw new CartError(502, 'The cart service returned an invalid quote.')
  return {
    cartId: q.cartId,
    items: q.items.map((line: Record<string, unknown>) => ({
      id: line.id,
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      sku: line.sku,
      quantity: line.quantity,
      availableQuantity: line.availableQuantity,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.lineTotalMinor,
      currency: line.currency,
      status: line.status,
    })),
    currency: q.currency,
    subtotalMinor: q.subtotalMinor,
    amountDueMinor: q.amountDueMinor,
    checkoutReady: q.checkoutReady,
    issues: q.issues,
    stockChecked: q.stockChecked,
    quotedAt: q.quotedAt,
  }
}
export function createGuestCartHandler(config: Config) {
  const send = config.fetch || fetch,
    now = config.now || Date.now
  const cookieName = (config.production ? '__Host-' : '') + 'eshop-guest-cart'
  return async function handle(request: Request) {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Origin',
      'X-Content-Type-Options': 'nosniff',
    })
    const clear = () =>
      headers.append(
        'Set-Cookie',
        `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.production ? '; Secure' : ''}`,
      )
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers })
    let token = '',
      merging = false
    try {
      if (request.method !== 'POST')
        return response({ message: 'Method not allowed.' }, 405)
      const configured = config.appOrigin()
      if (config.production && !configured)
        throw new CartError(503, 'Application origin is not configured.')
      const origin = new URL(configured || request.url).origin
      if (
        (config.production && !origin.startsWith('https://')) ||
        request.headers.get('origin') !== origin ||
        request.headers.get('sec-fetch-site') === 'cross-site' ||
        request.headers.get('x-eshop-cart') !== '1'
      )
        throw new CartError(403, 'Request origin is not allowed.')
      if (
        request.headers.get('content-type')?.split(';')[0].trim() !==
        'application/json'
      )
        throw new CartError(415, 'JSON is required.')
      const reader = request.body?.getReader()
      if (!reader) throw new CartError(400, 'Invalid cart request.')
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 4096) {
            await reader.cancel()
            throw new CartError(413, 'Request too large.')
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      let body: Record<string, unknown>
      try {
        const value = JSON.parse(new TextDecoder().decode(bytes))
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error()
        body = value
      } catch {
        throw new CartError(400, 'Invalid cart request.')
      }
      const action = body.action
      if (
        !['read', 'add', 'set', 'remove', 'clear', 'revoke', 'merge'].includes(
          String(action),
        )
      )
        throw new CartError(400, 'Invalid cart action.')
      const fields =
        action === 'add'
          ? ['productId', 'variantId', 'quantity', 'requestId']
          : action === 'set'
            ? ['productId', 'variantId', 'quantity']
            : action === 'remove'
              ? ['id']
              : action === 'merge'
                ? ['customerId']
                : []
      if (Object.keys(body).some((key) => !['action', ...fields].includes(key)))
        throw new CartError(400, 'Invalid cart request fields.')
      if (
        (action === 'set' || action === 'add') &&
        (!uuid(body.productId) ||
          (body.variantId != null && !uuid(body.variantId)) ||
          !Number.isInteger(body.quantity) ||
          Number(body.quantity) < 1 ||
          Number(body.quantity) > 99)
      )
        throw new CartError(400, 'Invalid product, variant or quantity.')
      if (action === 'add' && !uuid(body.requestId))
        throw new CartError(400, 'Invalid addition request ID.')
      if (
        (action === 'remove' && !uuid(body.id)) ||
        (action === 'merge' && !uuid(body.customerId))
      )
        throw new CartError(400, 'Invalid cart identity.')
      const cookies = (request.headers.get('cookie') || '')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.startsWith(cookieName + '='))
      if (cookies.length === 1) {
        const candidate = cookies[0].slice(cookieName.length + 1)
        if (/^[A-Za-z0-9_-]{43}$/.test(candidate)) token = candidate
      }
      async function upstream(
        route: string,
        method = 'GET',
        data?: unknown,
        access?: string,
      ) {
        let result: Response
        try {
          result = await send(
            config.apiOrigin() +
              route +
              (/^\/v1\/(cart|guest-cart)(\/|$)/.test(route) &&
              !(route === '/v1/guest-cart' && method !== 'GET')
                ? '?view=draft'
                : ''),
            {
              method,
              headers: {
                Accept: 'application/json',
                ...(data === undefined
                  ? {}
                  : { 'Content-Type': 'application/json' }),
                ...(access
                  ? { Authorization: 'Bearer ' + access }
                  : token
                    ? { 'X-Guest-Cart-Token': token }
                    : {}),
              },
              ...(data === undefined ? {} : { body: JSON.stringify(data) }),
              cache: 'no-store',
              redirect: 'error',
              signal: AbortSignal.timeout(12000),
            },
          )
        } catch {
          throw new CartError(
            503,
            'The cart service could not be reached. Review the cart before retrying a change.',
          )
        }
        if (!result.ok) {
          let message =
            result.status === 401
              ? 'The guest cart expired or was already consumed.'
              : result.status === 409
                ? 'The cart change could not be completed. Refresh and review stock, currency and active checkout before retrying.'
                : result.status === 429
                  ? 'Too many requests. Please wait.'
                  : 'The cart request could not be completed.'
          if ([400, 409, 422].includes(result.status)) {
            const value = await result.json().catch(() => null)
            if (typeof value?.message === 'string')
              message = value.message
                .replace(/[\u0000-\u001f]/g, '')
                .slice(0, 400)
          }
          throw new CartError(
            result.status,
            message,
            result.status === 401
              ? access
                ? 'CUSTOMER_SESSION_REQUIRED'
                : 'GUEST_UNAVAILABLE'
              : 'CART_REQUEST_FAILED',
            result.headers.get('retry-after'),
          )
        }
        try {
          return await result.json()
        } catch {
          throw new CartError(
            502,
            'The cart service returned an invalid response.',
          )
        }
      }
      if (action === 'read' && !token)
        return response({ guest: false, cart: null })
      if (action === 'revoke') {
        try {
          if (token) await upstream('/v1/guest-cart', 'DELETE')
          clear()
          return response({ revoked: true })
        } catch (error) {
          clear()
          if (error instanceof CartError && error.status === 401)
            return response({ revoked: true })
          throw new CartError(
            503,
            'Guest cart cleared on this browser; server revocation could not be confirmed.',
            'REVOCATION_UNCONFIRMED',
          )
        }
      }
      if (action === 'merge') {
        merging = true
        if (!token) return response({ guest: false, cart: null })
        const sessionHeaders = new Headers(request.headers)
        sessionHeaders.set('x-eshop-session', '1')
        const restored = await config.restoreSession(
          new Request(request.url, {
            method: 'POST',
            headers: sessionHeaders,
            body: JSON.stringify({ action: 'refresh' }),
          }),
        )
        const setCookie = restored.headers.get('set-cookie')
        if (setCookie) headers.append('Set-Cookie', setCookie)
        if (!restored.ok)
          throw new CartError(
            restored.status,
            restored.status === 401
              ? 'Please sign in again before merging your guest cart.'
              : 'Could not restore the customer session. The guest cart is unchanged.',
            restored.status === 401
              ? 'CUSTOMER_SESSION_REQUIRED'
              : 'SESSION_UNAVAILABLE',
            restored.headers.get('retry-after'),
          )
        const session = await restored.json()
        if (
          session.user?.role !== 'CUSTOMER' ||
          session.user?.id !== body.customerId ||
          typeof session.accessToken !== 'string'
        )
          throw new CartError(
            409,
            'The signed-in account changed. Reload before merging.',
            'ACCOUNT_CHANGED',
          )
        const cart = await upstream(
          '/v1/cart/merge',
          'POST',
          { guestToken: token },
          session.accessToken,
        )
        clear()
        return response({ guest: false, cart: quote(cart) })
      }
      if ((action === 'set' || action === 'add') && !token) {
        const created = await upstream('/v1/guest-cart', 'POST')
        const expires = Date.parse(created.expiresAt),
          age = Math.min(14 * 86400, Math.floor((expires - now()) / 1000))
        if (
          typeof created.guestToken !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(created.guestToken) ||
          !Number.isFinite(age) ||
          age <= 0
        )
          throw new CartError(
            502,
            'The cart service returned an invalid capability.',
          )
        token = created.guestToken
        headers.append(
          'Set-Cookie',
          `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}; Expires=${new Date(expires).toUTCString()}${config.production ? '; Secure' : ''}`,
        )
      }
      if (!token)
        throw new CartError(
          401,
          'No active guest cart exists.',
          'GUEST_UNAVAILABLE',
        )
      const cart =
        action === 'add'
          ? await upstream('/v1/guest-cart/items/add', 'POST', {
              productId: body.productId,
              variantId: body.variantId ?? null,
              quantity: body.quantity,
              requestId: body.requestId,
            })
          : action === 'set'
            ? await upstream('/v1/guest-cart/items', 'PUT', {
                productId: body.productId,
                variantId: body.variantId ?? null,
                quantity: body.quantity,
              })
            : action === 'remove'
              ? await upstream('/v1/guest-cart/items/' + body.id, 'DELETE')
              : action === 'clear'
                ? await upstream('/v1/guest-cart/items', 'DELETE')
                : await upstream('/v1/guest-cart')
      return response({ guest: true, cart: quote(cart) })
    } catch (error) {
      const failure =
        error instanceof CartError
          ? error
          : new CartError(503, 'The cart service is temporarily unavailable.')
      if (failure.code === 'GUEST_UNAVAILABLE' && !merging) clear()
      if (failure.retry && /^\d+$/.test(failure.retry))
        headers.set(
          'Retry-After',
          String(Math.min(Number(failure.retry), 3600)),
        )
      return response(
        { message: failure.message, code: failure.code },
        failure.status,
      )
    }
  }
}
