import { createStore } from 'zustand/vanilla'
import type { Session } from './api/runtime'

type Query = Record<string, string | number | boolean | undefined>
type Entry = {
  route: string
  value?: unknown
  expires: number
  pending?: Promise<unknown>
}
const allowed =
  /^\/v1\/(?:account\/(?:profile|addresses)|notifications\/preferences|orders(?:\/[a-f0-9-]{36}(?:\/(?:returns|replacements|tracking))?)?|payments\/orders\/[a-f0-9-]{36}\/refunds)$/
export const accountOwner = (session: Session) =>
  session.status === 'authenticated' && session.user?.role === 'CUSTOMER'
    ? session.epoch + ':' + session.user.id
    : null
export const accountKey = (route: string, query: Query = {}) =>
  JSON.stringify([
    route,
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  ])

export function createAccountCache({
  session,
  request,
  now = Date.now,
  limit = 40,
}: {
  session: () => Session
  request: (route: string, query: Query) => Promise<unknown>
  now?: () => number
  limit?: number
}) {
  const store = createStore<{
    owner: string | null
    entries: Map<string, Entry>
  }>(() => ({ owner: null, entries: new Map() }))
  function syncSession() {
    const owner = accountOwner(session())
    if (store.getState().owner !== owner)
      store.setState({ owner, entries: new Map() })
    return owner
  }
  function guard(owner: string) {
    if (syncSession() !== owner)
      throw new Error('The account changed. Please reopen this page.')
  }
  function invalidate(prefix: string) {
    syncSession()
    const entries = new Map(store.getState().entries)
    for (const [key, entry] of entries)
      if (entry.route === prefix || entry.route.startsWith(prefix + '/'))
        entries.delete(key)
    store.setState({ entries })
  }
  function peek<T>(route: string, query: Query = {}, stale = false): T | null {
    if (!syncSession()) return null
    const entry = store.getState().entries.get(accountKey(route, query))
    return entry?.value !== undefined && (stale || entry.expires > now())
      ? (structuredClone(entry.value) as T)
      : null
  }
  function read<T>(
    route: string,
    query: Query = {},
    force = false,
  ): Promise<T> {
    if (!allowed.test(route))
      return Promise.reject(
        new Error('This resource cannot enter the account cache.'),
      )
    const owner = syncSession()
    if (!owner) return Promise.reject(new Error('Please sign in to continue.'))
    const key = accountKey(route, query)
    const previous = store.getState().entries.get(key)
    if (previous?.pending) return previous.pending as Promise<T>
    if (!force && previous?.value !== undefined && previous.expires > now())
      return Promise.resolve(structuredClone(previous.value) as T)
    const entry: Entry = { route, value: previous?.value, expires: 0 }
    const pending = Promise.resolve()
      .then(() => {
        guard(owner)
        return request(route, query)
      })
      .then(
        (value) => {
          guard(owner)
          if (store.getState().entries.get(key) !== entry)
            throw new Error('Account information changed. Please try again.')
          const ttl = route.startsWith('/v1/account/')
            ? 300000
            : route === '/v1/notifications/preferences'
              ? 60000
              : 15000
          entry.value = structuredClone(value)
          entry.expires = now() + ttl
          entry.pending = undefined
          store.setState({ entries: new Map(store.getState().entries) })
          return structuredClone(value) as T
        },
        (error) => {
          if (store.getState().entries.get(key) === entry) {
            const entries = new Map(store.getState().entries)
            entries.delete(key)
            store.setState({ entries })
          }
          throw error
        },
      )
    entry.pending = pending
    const entries = new Map(store.getState().entries)
    entries.delete(key)
    entries.set(key, entry)
    while (entries.size > limit) entries.delete(entries.keys().next().value!)
    store.setState({ entries })
    return pending
  }
  function prefetch(route: string, query: Query = {}) {
    if (syncSession()) void read(route, query).catch(() => undefined)
  }
  return { store, syncSession, peek, read, prefetch, invalidate }
}
