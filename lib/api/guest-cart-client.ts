import { ApiRequestError } from './runtime'
export class GuestCartError extends ApiRequestError {
  code: string
  constructor(
    status: number,
    message: string,
    code: string,
    retry: number | null = null,
  ) {
    super(status, message, retry)
    this.code = code
  }
}
let queue: Promise<unknown> = Promise.resolve()
export function shoppingLock<T>(work: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      return await navigator.locks.request('eshop-shopping-write', work)
    return await work()
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}
export async function guestCartRequest<T>(
  action: 'read' | 'add' | 'set' | 'remove' | 'clear' | 'revoke' | 'merge',
  body: Record<string, unknown> = {},
  guard: () => void = () => undefined,
): Promise<T> {
  const run = async () => {
    guard()
    let response: Response
    try {
      response = await fetch('/api/cart/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-eShop-Cart': '1' },
        body: JSON.stringify({ action, ...body }),
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(action === 'merge' ? 30000 : 15000),
      })
    } catch {
      throw new GuestCartError(
        503,
        'Could not confirm the cart request. Review the current cart before retrying.',
        'NETWORK_ERROR',
      )
    }
    guard()
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      const retry = response.headers.get('retry-after')
      throw new GuestCartError(
        response.status,
        typeof result?.message === 'string'
          ? result.message
          : 'The cart request failed.',
        typeof result?.code === 'string' ? result.code : 'CART_REQUEST_FAILED',
        retry && /^\d+$/.test(retry) ? Math.min(Number(retry), 3600) : null,
      )
    }
    return result as T
  }
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('eshop-session-customer', run)
    : run()
}
