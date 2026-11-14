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
