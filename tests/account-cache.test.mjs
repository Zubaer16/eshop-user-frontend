import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAccountCache } from '../lib/account-cache.ts'

const identity = (id = 'A', epoch = 1) => ({
  status: 'authenticated',
  epoch,
  user: { id, role: 'CUSTOMER' },
  notice: '',
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function fixture(request, options = {}) {
  let session = identity()
  const cache = createAccountCache({
    session: () => session,
    request,
    ...options,
  })
  return {
    cache,
    change: (value) => {
      session = value
      cache.syncSession()
    },
  }
}

test('private reads share a request, respect freshness and keep mutable callers separate', async () => {
  let time = 0,
    calls = 0
  const f = fixture(
    async () => {
      calls++
      return { items: [{ city: 'Dhaka' }] }
    },
    { now: () => time },
  )
  const one = f.cache.read('/v1/account/addresses')
  const two = f.cache.read('/v1/account/addresses')
  assert.equal(one, two)
  const result = await one
  result.items[0].city = 'Changed'
  assert.equal(f.cache.peek('/v1/account/addresses').items[0].city, 'Dhaka')
  await f.cache.read('/v1/account/addresses')
  assert.equal(calls, 1)
  time = 300001
  assert.equal(f.cache.peek('/v1/account/addresses'), null)
  assert.equal(
    f.cache.peek('/v1/account/addresses', {}, true).items[0].city,
    'Dhaka',
  )
  await f.cache.read('/v1/account/addresses')
  assert.equal(calls, 2)
})

test('logout and account changes clear all private data synchronously', async () => {
  const f = fixture(async () => ({ secret: 'A address' }))
  await f.cache.read('/v1/account/profile')
  f.change(identity('B', 2))
  assert.equal(f.cache.peek('/v1/account/profile', {}, true), null)
  assert.equal(f.cache.store.getState().entries.size, 0)
  await f.cache.read('/v1/account/addresses')
  f.change({ status: 'anonymous', epoch: 3, user: null, notice: '' })
  assert.equal(f.cache.store.getState().entries.size, 0)
  await assert.rejects(f.cache.read('/v1/account/addresses'), /sign in/)
})

test('a late response from a former owner cannot return or replace the current account data', async () => {
  const old = deferred()
  let calls = 0
  const f = fixture(() =>
    ++calls === 1 ? old.promise : Promise.resolve({ name: 'B' }),
  )
  const pending = f.cache.read('/v1/account/profile')
  await Promise.resolve()
  f.change(identity('B', 2))
  await f.cache.read('/v1/account/profile')
  old.resolve({ name: 'A' })
  await assert.rejects(pending, /account changed/)
  assert.deepEqual(f.cache.peek('/v1/account/profile'), { name: 'B' })
})

test('a superseded session cannot launch a queued request, including relogin to the same account', async () => {
  let calls = 0
  const f = fixture(async () => {
    calls++
    return {}
  })
  const pending = f.cache.read('/v1/account/addresses')
  f.change(identity('A', 2))
  await assert.rejects(pending, /account changed/)
  assert.equal(calls, 0)
})

test('mutation invalidation fences old reads and preserves the newer refresh', async () => {
  const old = deferred()
  let calls = 0
  const f = fixture(() =>
    ++calls === 1 ? old.promise : Promise.resolve({ revision: 2 }),
  )
  const pending = f.cache.read('/v1/notifications/preferences')
  await Promise.resolve()
  f.cache.invalidate('/v1/notifications/preferences')
  await f.cache.read('/v1/notifications/preferences')
  old.resolve({ revision: 1 })
  await assert.rejects(pending, /information changed/)
  assert.deepEqual(f.cache.peek('/v1/notifications/preferences'), {
    revision: 2,
  })
})

test('failed preloads stay retryable and unsupported private endpoints are rejected', async () => {
  let calls = 0
  const f = fixture(async () => {
    if (++calls === 1) throw new Error('offline')
    return { items: [] }
  })
  await assert.rejects(f.cache.read('/v1/account/addresses'), /offline/)
  assert.equal(f.cache.peek('/v1/account/addresses'), null)
  await f.cache.read('/v1/account/addresses')
  for (const route of [
    '/v1/auth/me',
    '/v1/admin/orders',
    '/v1/payments/orders/id',
    '/v1/checkout/recovery',
  ])
    await assert.rejects(f.cache.read(route), /cannot enter/)
  assert.equal(calls, 2)
})

test('order queries have independent keys, bounded entries and a short freshness window', async () => {
  let time = 0,
    calls = 0
  const f = fixture(
    async (_route, query) => {
      calls++
      return { page: query.page }
    },
    { now: () => time, limit: 2 },
  )
  await f.cache.read('/v1/orders', { page: 1, limit: 20 })
  await f.cache.read('/v1/orders', { limit: 20, page: 1 })
  assert.equal(calls, 1)
  await f.cache.read('/v1/orders', { page: 2, limit: 20 })
  await f.cache.read('/v1/orders', { page: 3, limit: 20 })
  assert.equal(f.cache.store.getState().entries.size, 2)
  assert.equal(f.cache.peek('/v1/orders', { page: 1, limit: 20 }), null)
  time = 15001
  await f.cache.read('/v1/orders', { page: 3, limit: 20 })
  assert.equal(calls, 4)
  f.cache.invalidate('/v1/orders')
  assert.equal(f.cache.store.getState().entries.size, 0)
})
