import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicCache } from '../lib/public-cache.ts'

test('server snapshots seed only their remaining lifetime without replacing newer browser data', async () => {
  let now = 100
  const cache = createPublicCache({ now: () => now, ttl: 30 })
  cache.seed('/v1/store/homepage', {}, 'server', 115)
  assert.equal(
    await cache.get('/v1/store/homepage', {}, async () => 'unexpected'),
    'server',
  )
  now = 116
  assert.equal(cache.peek('/v1/store/homepage'), null)
  await cache.get('/v1/store/homepage', {}, async () => 'newer')
  cache.seed('/v1/store/homepage', {}, 'older', 120)
  assert.equal(cache.peek('/v1/store/homepage'), 'newer')
  cache.seed('/v1/products', {}, 'expired', 110)
  assert.equal(cache.peek('/v1/products'), null)
})

test('public reads share requests and reuse data only within the freshness window', async () => {
  let time = 0,
    calls = 0,
    resolve
  const cache = createPublicCache({ now: () => time, ttl: 30 })
  const load = () => {
    calls++
    return new Promise((r) => {
      resolve = r
    })
  }
  const first = cache.get('/v1/products', { page: 1, category: 'audio' }, load)
  const second = cache.get('/v1/products', { category: 'audio', page: 1 }, load)
  assert.equal(first, second)
  await Promise.resolve()
  assert.equal(calls, 1)
  resolve({ items: ['first'] })
  await first
  assert.deepEqual(cache.peek('/v1/products', { page: 1, category: 'audio' }), {
    items: ['first'],
  })
  assert.deepEqual(
    await cache.get('/v1/products', { category: 'audio', page: 1 }, load),
    { items: ['first'] },
  )
  assert.equal(calls, 1)
  assert.equal(cache.peek('/v1/products', { page: 2, category: 'audio' }), null)
  time = 31
  assert.equal(cache.peek('/v1/products', { category: 'audio', page: 1 }), null)
  const refreshed = cache.get(
    '/v1/products',
    { category: 'audio', page: 1 },
    async () => ({ items: ['new'] }),
  )
  assert.deepEqual(await refreshed, { items: ['new'] })
})

test('explicit refresh bypasses fresh results; failed refresh is never retained', async () => {
  const cache = createPublicCache()
  await cache.get('/v1/store/homepage', {}, async () => 'old')
  assert.equal(
    await cache.get('/v1/store/homepage', {}, async () => 'published', true),
    'published',
  )
  await assert.rejects(
    cache.get(
      '/v1/store/homepage',
      {},
      async () => {
        throw Error('withdrawn')
      },
      true,
    ),
  )
  assert.equal(cache.peek('/v1/store/homepage'), null)
  assert.equal(
    await cache.get('/v1/store/homepage', {}, async () => 'recovered'),
    'recovered',
  )
})

test('private routes cannot be cached and public memory use is bounded', async () => {
  const cache = createPublicCache({ limit: 2 })
  for (const route of [
    '/v1/cart',
    '/v1/checkout',
    '/v1/account/profile',
    '/v1/admin/products',
    '/v1/products/../orders',
  ])
    assert.throws(() => cache.get(route, {}, async () => 'private'))
  await cache.get('/v1/products', { page: 1 }, async () => 1)
  await cache.get('/v1/products', { page: 2 }, async () => 2)
  await cache.get('/v1/products', { page: 3 }, async () => 3)
  assert.equal(cache.peek('/v1/products', { page: 1 }), null)
  assert.equal(cache.peek('/v1/products', { page: 3 }), 3)
})

test('store bootstrap, operations and categories share public freshness without private identity', async () => {
  const cache = createPublicCache()
  for (const route of [
    '/v1/store/bootstrap',
    '/v1/store/operations',
    '/v1/categories',
  ]) {
    let calls = 0
    const load = async () => {
      calls++
      return { configured: true }
    }
    await cache.get(route, {}, load)
    await cache.get(route, {}, load)
    assert.equal(calls, 1)
  }
  assert.throws(
    () => cache.get('/v1/account/profile', {}, async () => ({})),
    /not public/,
  )
})
