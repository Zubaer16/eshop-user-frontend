import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGuestCartHandler } from '../lib/api/guest-cart-server.ts'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const token = 'g'.repeat(43),
  access = 'a'.repeat(40),
  now = Date.UTC(2026, 10, 7)
const cart = () => ({
  cartId: id(1),
  items: [
    {
      id: id(2),
      productId: id(3),
      variantId: null,
      title: 'Server item',
      sku: 'SKU',
      quantity: 2,
      availableQuantity: 10,
      unitPriceMinor: 125,
      lineTotalMinor: 250,
      currency: 'USD',
      status: 'AVAILABLE',
      tokenHash: 'do-not-forward',
    },
  ],
  currency: 'USD',
  subtotalMinor: 250,
  amountDueMinor: null,
  checkoutReady: true,
  issues: [],
  quotedAt: '2026-11-07T00:00:00Z',
  guestToken: token,
  objectKey: 'do-not-forward',
})
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers })
function setup(options = {}) {
  const calls = [],
    sessions = []
  const handler = createGuestCartHandler({
    production: options.production || false,
    appOrigin: () => options.origin || 'https://shop.example.test',
    apiOrigin: () => 'https://api.example.test',
    now: () => now,
    fetch: async (url, init) => {
      const call = {
        url,
        ...init,
        data: init.body ? JSON.parse(init.body) : null,
      }
      calls.push(call)
      if (options.fetch) return options.fetch(call)
      if (url.endsWith('/v1/guest-cart') && init.method === 'POST')
        return json(
          {
            guestToken: token,
            guestCartId: id(1),
            expiresAt: new Date(now + 14 * 86400000).toISOString(),
          },
          201,
        )
      return json(cart())
    },
    restoreSession: async (request) => {
      sessions.push(await request.json())
      return options.session
        ? options.session()
        : json(
            { accessToken: access, user: { id: id(9), role: 'CUSTOMER' } },
            200,
            {
              'Set-Cookie':
                'eshop-user-session=rotated; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
            },
          )
    },
  })
  const request = (action, extra = {}, headers = {}, method = 'POST') =>
    handler(
      new Request('https://shop.example.test/api/cart/guest', {
        method,
        headers: {
          Origin: 'https://shop.example.test',
          'Content-Type': 'application/json',
          'X-eShop-Cart': '1',
          ...headers,
        },
        ...(method === 'POST'
          ? { body: JSON.stringify({ action, ...extra }) }
          : {}),
      }),
    )
  return { calls, sessions, request }
}
const cookie = { Cookie: 'eshop-guest-cart=' + token }
test('guest read without a cookie does not create a cart or reveal any capability', async () => {
  const f = setup(),
    response = await f.request('read')
  assert.deepEqual(await response.json(), { guest: false, cart: null })
  assert.equal(f.calls.length, 0)
  assert.equal(f.sessions.length, 0)
})
test('first explicit set creates a fixed-lifetime HttpOnly capability and projects only quote fields', async () => {
  const f = setup(),
    response = await f.request(
      'set',
      { productId: id(3), variantId: null, quantity: 2 },
      { Authorization: 'Bearer attacker' },
    ),
    body = await response.json()
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('set-cookie'),
    /HttpOnly; SameSite=Lax; Max-Age=1209600/,
  )
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].method, 'PUT')
  assert.equal(f.calls[1].headers['X-Guest-Cart-Token'], token)
  assert.equal(f.calls[1].headers.Authorization, undefined)
  assert.equal(f.calls[1].headers.Cookie, undefined)
  assert.deepEqual(f.calls[1].data, {
    productId: id(3),
    variantId: null,
    quantity: 2,
  })
  assert.doesNotMatch(JSON.stringify(body), new RegExp(token))
  assert.equal(body.cart.guestToken, undefined)
  assert.equal(body.cart.objectKey, undefined)
  assert.equal(body.cart.items[0].tokenHash, undefined)
  assert.match(response.headers.get('cache-control'), /no-store/)
})
test('CSRF, unsafe methods, unknown fields and noncanonical inputs fail before upstream writes', async () => {
  const f = setup()
  for (const headers of [
    { Origin: 'https://evil.example.test' },
    { Origin: '' },
    { 'X-eShop-Cart': '' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])
    assert.equal((await f.request('clear', {}, headers)).status, 403)
  assert.equal((await f.request('read', {}, {}, 'GET')).status, 405)
  assert.equal(
    (await f.request('set', { productId: 'demo', quantity: 1 })).status,
    400,
  )
  assert.equal(
    (await f.request('set', { productId: id(3), quantity: 1, priceMinor: 1 }))
      .status,
    400,
  )
  assert.equal(
    (await f.request('set', { productId: id(3), quantity: 100 })).status,
    400,
  )
  assert.equal(
    (
      await f.request('set', {
        productId: id(3),
        quantity: 1,
        extra: 'x'.repeat(5000),
      })
    ).status,
    413,
  )
  assert.equal(f.calls.length, 0)
})
test('merge restores only the intended current customer, rotates the auth cookie and clears guest only on success', async () => {
  const f = setup(),
    response = await f.request('merge', { customerId: id(9) }, cookie),
    body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(f.sessions, [{ action: 'refresh' }])
  assert.equal(f.calls[0].url, 'https://api.example.test/v1/cart/merge')
  assert.equal(f.calls[0].headers.Authorization, 'Bearer ' + access)
  assert.deepEqual(f.calls[0].data, { guestToken: token })
  assert.equal(f.calls[0].headers['X-Guest-Cart-Token'], undefined)
  const cookies = response.headers.getSetCookie()
  assert.equal(cookies.length, 2)
  assert(cookies.some((c) => /eshop-guest-cart=;.*Max-Age=0/.test(c)))
  assert(cookies.some((c) => c.startsWith('eshop-user-session=')))
  assert.equal(body.guest, false)
  assert.doesNotMatch(JSON.stringify(body), new RegExp(access + '|' + token))
})
test('wrong account and merge conflicts preserve the guest capability and never silently replace the cart', async () => {
  const wrong = setup(),
    response = await wrong.request('merge', { customerId: id(8) }, cookie)
  assert.equal(response.status, 409)
  assert.equal(wrong.calls.length, 0)
  assert(
    !response.headers
      .getSetCookie()
      .some((c) => c.startsWith('eshop-guest-cart=')),
  )
  const conflict = setup({
      fetch: () => json({ message: 'Insufficient stock' }, 409),
    }),
    failed = await conflict.request('merge', { customerId: id(9) }, cookie)
  assert.equal(failed.status, 409)
  assert.match((await failed.json()).message, /Insufficient stock/)
  assert(
    !failed.headers
      .getSetCookie()
      .some((c) => c.startsWith('eshop-guest-cart=')),
  )
  assert.equal(conflict.calls.length, 1)
})
test('guest expiry clears only its cookie while unavailable customer authentication preserves guest items', async () => {
  const expired = setup({ fetch: () => json({}, 401) }),
    response = await expired.request('read', {}, cookie)
  assert.equal(response.status, 401)
  assert.match(
    response.headers.get('set-cookie'),
    /eshop-guest-cart=;.*Max-Age=0/,
  )
  const unauth = setup({
      session: () =>
        json({}, 401, {
          'Set-Cookie': 'eshop-user-session=; Path=/; Max-Age=0',
        }),
    }),
    failed = await unauth.request('merge', { customerId: id(9) }, cookie)
  assert.equal(failed.status, 401)
  assert.equal((await failed.json()).code, 'CUSTOMER_SESSION_REQUIRED')
  assert.equal(unauth.calls.length, 0)
  assert(
    !failed.headers
      .getSetCookie()
      .some((c) => c.startsWith('eshop-guest-cart=')),
  )
})
test('uncertain set outcomes keep the issued capability; explicit retries send the same absolute quantity', async () => {
  let writes = 0
  const f = setup({
    fetch: (call) => {
      writes++
      assert.equal(call.method, 'PUT')
      assert.equal(call.data.quantity, 2)
      return writes === 1
        ? Promise.reject(new Error('lost response'))
        : json(cart())
    },
  })
  assert.equal(
    (
      await f.request(
        'set',
        { productId: id(3), variantId: null, quantity: 2 },
        cookie,
      )
    ).status,
    503,
  )
  assert.equal(
    (
      await f.request(
        'set',
        { productId: id(3), variantId: null, quantity: 2 },
        cookie,
      )
    ).status,
    200,
  )
  assert.equal(writes, 2)
})
test('revoke clears the browser capability even when server confirmation fails; production cookie is host-only Secure', async () => {
  const down = setup({
      fetch: () => {
        throw new Error('offline')
      },
    }),
    revoked = await down.request('revoke', {}, cookie)
  assert.equal(revoked.status, 503)
  assert.match(revoked.headers.get('set-cookie'), /Max-Age=0/)
  assert.match((await revoked.json()).message, /could not be confirmed/)
  const production = setup({ production: true }),
    response = await production.request('set', {
      productId: id(3),
      variantId: null,
      quantity: 2,
    })
  assert.match(response.headers.get('set-cookie'), /^__Host-eshop-guest-cart=/)
  assert.match(response.headers.get('set-cookie'), /; Secure/)
  assert.doesNotMatch(response.headers.get('set-cookie'), /Domain=/)
})
