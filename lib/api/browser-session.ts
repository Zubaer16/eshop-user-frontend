import { ApiRequestError, type PersistentSession } from './runtime'

export function createBrowserSession(
  audience: 'customer' | 'staff',
): PersistentSession {
  // Rotating one shared cookie must be serialized across tabs as well as requests.
  let queue: Promise<unknown> = Promise.resolve()
  return {
    exchange(action, credentials) {
      const exchange = async () => {
        let response: Response
        try {
          response = await fetch('/api/auth/session', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            headers: {
              'Content-Type': 'application/json',
              'X-eShop-Session': '1',
            },
            body: JSON.stringify({ action, ...credentials }),
            signal: AbortSignal.timeout(15000),
          })
        } catch {
          throw new ApiRequestError(
            503,
            'Could not reach the sign-in service. Please try again.',
          )
        }
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          const retry = response.headers.get('retry-after')
          throw new ApiRequestError(
            response.status,
            typeof body?.message === 'string'
              ? body.message
              : 'The session request failed.',
            retry && /^\d+$/.test(retry) ? Math.min(Number(retry), 3600) : null,
          )
        }
        return body
      }
      const run = () =>
        typeof navigator !== 'undefined' && navigator.locks
          ? navigator.locks.request('eshop-session-' + audience, exchange)
          : exchange()
      const result = queue.then(run, run)
      queue = result.catch(() => undefined)
      return result
    },
  }
}

export const sessionChannelName = (audience: 'customer' | 'staff') =>
  'eshop-auth-' + audience
export const sessionSource = globalThis.crypto.randomUUID()
export function announceSession(
  audience: 'customer' | 'staff',
  type: 'login' | 'logout',
) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(sessionChannelName(audience))
  channel.postMessage({ source: sessionSource, type })
  channel.close()
}
