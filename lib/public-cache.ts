type Query = Record<string, string | number | boolean | undefined>
type Entry = { value?: unknown; expires: number; pending?: Promise<unknown> }

// Public presentation data only. Private responses and writes never enter this cache.
export function publicKey(route: string, query: Query = {}) {
  if (
    !/^\/v1\/(?:categories|products(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|store\/(?:homepage|collections\/[a-z0-9]+(?:-[a-z0-9]+)*))$/.test(
      route,
    )
  )
    throw new Error('This resource is not public catalog content.')
  return JSON.stringify([
    route,
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  ])
}

export function createPublicCache({
  now = Date.now,
  ttl = 30000,
  limit = 40,
} = {}) {
  const entries = new Map<string, Entry>()
  function touch(key: string, entry: Entry) {
    entries.delete(key)
    entries.set(key, entry)
    while (entries.size > limit) entries.delete(entries.keys().next().value!)
  }
  return {
    seed<T>(route: string, query: Query, value: T, expires: number) {
      const key = publicKey(route, query),
        existing = entries.get(key)
      if (
        expires <= now() ||
        existing?.pending ||
        (existing && existing.expires > now())
      )
        return
      touch(key, { value, expires: Math.min(expires, now() + ttl) })
    },
    peek<T>(route: string, query: Query = {}): T | null {
      const key = publicKey(route, query),
        entry = entries.get(key)
      if (!entry || entry.expires <= now()) return null
      touch(key, entry)
      return entry.value as T
    },
    get<T>(
      route: string,
      query: Query,
      load: () => Promise<T>,
      force = false,
    ): Promise<T> {
      const key = publicKey(route, query),
        existing = entries.get(key)
      if (existing?.pending) return existing.pending as Promise<T>
      if (!force && existing && existing.expires > now()) {
        touch(key, existing)
        return Promise.resolve(existing.value as T)
      }
      const entry: Entry = { expires: 0 }
      const pending = Promise.resolve()
        .then(load)
        .then(
          (value) => {
            if (entries.get(key) === entry) {
              entry.value = value
              entry.expires = now() + ttl
              entry.pending = undefined
            }
            return value
          },
          (error) => {
            if (entries.get(key) === entry) entries.delete(key)
            throw error
          },
        )
      entry.pending = pending
      touch(key, entry)
      return pending
    },
  }
}
