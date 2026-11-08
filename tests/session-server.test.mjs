import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionHandler } from '../lib/api/session-server.ts'

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'fixture@example.test',
  role: 'CUSTOMER',
  passwordHash: 'must-never-leak',
}
const token = 'r'.repeat(64),
  nextToken = 's'.repeat(64)
const pair = (identity = user, refresh = nextToken) => ({
  accessToken: 'a'.repeat(40),
  refreshToken: refresh,
  tokenType: 'Bearer',
  expiresIn: 600,
  user: identity,
})
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers })
function setup(options = {}) {
  const calls = []
  const handler = createSessionHandler({
    audience: options.audience || 'customer',
    production: options.production || false,
    apiOrigin: () => 'https://api.example.test',
    appOrigin: () => options.origin,
    fetch: async (url, init) => {
      const call = { url, ...init, data: JSON.parse(init.body) }
      calls.push(call)
      return options.fetch ? options.fetch(call) : json(pair())
    },
  })
  const request = (action, extra = {}, headers = {}, method = 'POST') =>
    handler(
      new Request('https://shop.example.test/api/auth/session', {
        method,
        headers: {
          Origin: 'https://shop.example.test',
          'Content-Type': 'application/json',
          'X-eShop-Session': '1',
          ...headers,
        },
        ...(method === 'POST'
          ? { body: JSON.stringify({ action, ...extra }) }
          : {}),
      }),
    )
  return { calls, request }
}
const credentials = { email: user.email, password: 'fixture-password-12' }

test('login sets a persistent HttpOnly cookie and returns only allowlisted access identity', async () => {
  const f = setup(),
    response = await f.request('login', credentials),
    body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.refreshToken, undefined)
  assert.equal(body.user.passwordHash, undefined)
  assert.match(
    response.headers.get('set-cookie'),
    /eshop-user-session=s+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000/,
  )
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(f.calls[0].url, 'https://api.example.test/v1/auth/login')
  assert.equal(f.calls[0].headers.Cookie, undefined)
  assert.equal(f.calls[0].redirect, 'error')
})
test('session writes reject foreign or missing Origin, missing custom header and non-JSON', async () => {
  const f = setup()
  for (const headers of [
    { Origin: 'https://attacker.example.test' },
    { Origin: '' },
    { 'X-eShop-Session': '' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])
    assert.equal((await f.request('login', credentials, headers)).status, 403)
  assert.equal(
    (await f.request('login', credentials, { 'Content-Type': 'text/plain' }))
      .status,
    415,
  )
  assert.equal((await f.request('refresh', {}, {}, 'GET')).status, 405)
  assert.equal(f.calls.length, 0)
})
test('staff bridge rejects public registration and wrong-audience sessions with revocation', async () => {
  const f = setup({
    audience: 'staff',
    fetch: (call) =>
      json(call.url.endsWith('/logout') ? { loggedOut: true } : pair()),
  })
  assert.equal((await f.request('register', credentials)).status, 403)
  assert.equal(f.calls.length, 0)
  const response = await f.request('login', credentials)
  assert.equal(response.status, 403)
  assert.match(
    response.headers.get('set-cookie'),
    /eshop-admin-session=;.*Max-Age=0/,
  )
  assert.equal(f.calls[0].url, 'https://api.example.test/v1/admin/auth/login')
  assert.equal(f.calls[1].data.refreshToken, nextToken)
})
test('refresh consumes only the own opaque cookie and rotates it without exposing it', async () => {
  const f = setup(),
    response = await f.request(
      'refresh',
      {},
      {
        Cookie:
          'eshop-user-session=' + token + '; eshop-admin-session=' + nextToken,
      },
    )
  assert.equal(f.calls[0].data.refreshToken, token)
  assert.equal((await response.json()).refreshToken, undefined)
  assert.match(
    response.headers.get('set-cookie'),
    new RegExp('session=' + nextToken),
  )
  assert.equal((await f.request('refresh')).status, 401)
  assert.equal(
    (await f.request('refresh', {}, { Cookie: 'eshop-user-session=bad' }))
      .status,
    401,
  )
  assert.equal(
    (await f.request('refresh', { refreshToken: token })).status,
    400,
  )
})
test('concurrent server refresh shares only its in-flight call and never caches rotated credentials', async () => {
  let resolve
  const gate = new Promise((r) => {
    resolve = r
  })
  const f = setup({ fetch: () => gate }),
    headers = { Cookie: 'eshop-user-session=' + token }
  const first = f.request('refresh', {}, headers),
    second = f.request('refresh', {}, headers)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(f.calls.length, 1)
  resolve(json(pair()))
  assert.equal((await first).status, 200)
  assert.equal((await second).status, 200)
  // A repeated old cookie must go back to Backend replay protection.
  await f.request('refresh', {}, headers)
  assert.equal(f.calls.length, 2)
})
test('logout clears the cookie even when upstream revocation cannot be confirmed', async () => {
  const f = setup({
    fetch: () => {
      throw new Error('offline')
    },
  })
  const response = await f.request(
    'logout',
    {},
    { Cookie: 'eshop-user-session=' + token },
  )
  assert.equal(response.status, 503)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  assert.match((await response.json()).message, /could not be confirmed/)
})
test('expired sessions clear cookies; temporary failures and limits retain them', async () => {
  for (const status of [401, 429, 503]) {
    const f = setup({
      fetch: () =>
        json({ internalSecret: 'never-leak' }, status, { 'Retry-After': '45' }),
    })
    const response = await f.request(
      'refresh',
      {},
      { Cookie: 'eshop-user-session=' + token },
    )
    assert.equal(response.status, status)
    assert.equal(response.headers.has('set-cookie'), status === 401)
    if (status === 429) assert.equal(response.headers.get('retry-after'), '45')
    assert.doesNotMatch(await response.text(), /never-leak/)
  }
})
test('production requires an explicit HTTPS app origin and uses a Secure host-only cookie', async () => {
  const f = setup({ production: true, origin: 'https://shop.example.test' })
  const response = await f.request('login', credentials)
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('set-cookie'),
    /^__Host-eshop-user-session=/,
  )
  assert.match(response.headers.get('set-cookie'), /; Secure/)
  assert.doesNotMatch(response.headers.get('set-cookie'), /Domain=/)
  assert.equal(
    (await setup({ production: true }).request('login', credentials)).status,
    503,
  )
})
test('bounded input rejects arbitrary fields and oversized bodies without upstream calls', async () => {
  const f = setup()
  assert.equal(
    (await f.request('login', { ...credentials, role: 'OWNER' })).status,
    400,
  )
  assert.equal(
    (await f.request('login', { ...credentials, password: 'a'.repeat(5000) }))
      .status,
    413,
  )
  assert.equal(
    (await f.request('register', { ...credentials, password: 'short' })).status,
    400,
  )
  assert.equal(f.calls.length, 0)
})
