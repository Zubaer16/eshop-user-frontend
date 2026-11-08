import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createApiClient,
  apiOrigin,
  safeReturnTo,
  ApiRequestError,
} from '../lib/api/runtime.ts'
const id = '00000000-0000-4000-8000-000000000001'
const user = {
  id,
  email: 'fixture@example.test',
  role: 'CUSTOMER',
  staffRole: null,
  permissions: [],
}
const pair = (revision = 'a', identity = user) => ({
  accessToken: revision.repeat(40),
  refreshToken: ('refresh-' + revision).repeat(5),
  tokenType: 'Bearer',
  expiresIn: 60,
  user: identity,
})
const cookiePair = () => {
  const result = pair()
  delete result.refreshToken
  return result
}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function setup(options = {}) {
  let clock = 0,
    handler = options.handler
  const calls = []
  const client = createApiClient({
    audience: options.audience || 'customer',
    baseUrl: () => 'https://api.example.test',
    now: () => clock,
    timeoutMs: options.timeoutMs || 1000,
    fetch: async (url, init) => {
      const call = {
        url: new URL(url),
        ...init,
        data: init.body ? JSON.parse(init.body) : null,
      }
      calls.push(call)
      const handled = handler ? await handler(call) : undefined
      if (handled) return handled
      if (
        call.url.pathname.endsWith('/login') ||
        call.url.pathname.endsWith('/register')
      )
        return json(pair())
      if (call.url.pathname.endsWith('/me')) return json(user)
      if (call.url.pathname.endsWith('/logout'))
        return json({ loggedOut: true })
      return json({ ok: true })
    },
  })
  return {
    client,
    calls,
    advance: (value) => {
      clock = value
    },
    handle: (fn) => {
      handler = fn
    },
  }
}
test('service origin and return URL rules reject credential leaks, duplicate prefixes and external redirects', () => {
  assert.equal(
    apiOrigin('https://api.example.test/'),
    'https://api.example.test',
  )
  for (const value of [
    'https://user:password@api.example.test',
    'https://api.example.test/v1',
    'https://api.example.test/?token=x',
    'file:///tmp',
  ])
    assert.throws(() => apiOrigin(value), ApiRequestError)
  assert.throws(() => apiOrigin('http://api.example.test', true))
  for (const value of [
    '//evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/sign-in',
    '/%00bad',
  ])
    assert.equal(safeReturnTo(value, '/account'), '/account')
  assert.equal(
    safeReturnTo('/account/orders?status=PAID', '/account'),
    '/account/orders?status=PAID',
  )
})
test('public PUT uses JSON, no cookies/bearer, and query values cannot inject additional parameters', async () => {
  const f = setup()
  await f.client.request('/v1/example', {
    method: 'PUT',
    auth: false,
    body: { value: 1 },
    query: { search: 'x&role=OWNER', active: false },
  })
  const call = f.calls[0]
  assert.equal(call.credentials, 'omit')
  assert.equal(call.cache, 'no-store')
  assert.equal(call.headers.Authorization, undefined)
  assert.equal(call.url.searchParams.get('search'), 'x&role=OWNER')
  assert.equal(call.url.searchParams.has('role'), false)
  assert.equal(call.method, 'PUT')
  assert.equal(
    JSON.stringify(f.client.getSnapshot()).includes('refreshToken'),
    false,
  )
})
test('wrong-audience identity is rejected and its issued session is revoked', async () => {
  const f = setup({ audience: 'staff' })
  await assert.rejects(
    f.client.signIn({ email: user.email, password: 'fixture-password' }),
    (e) => e.status === 403,
  )
  assert.equal(f.client.getSnapshot().status, 'anonymous')
  assert(f.calls.some((c) => c.url.pathname.endsWith('/logout')))
})
test('expired concurrent reads share one rotating refresh and use only the new bearer', async () => {
  const f = setup()
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  f.advance(50000)
  const gate = deferred()
  let refreshes = 0
  f.handle(async (call) => {
    if (call.url.pathname.endsWith('/refresh')) {
      refreshes++
      assert.equal(call.data.refreshToken, pair().refreshToken)
      await gate.promise
      return json(pair('b'))
    }
  })
  const reads = [1, 2, 3].map(() => f.client.request('/v1/account/profile'))
  await new Promise((r) => setTimeout(r, 0))
  gate.resolve()
  await Promise.all(reads)
  assert.equal(refreshes, 1)
  assert(
    f.calls
      .filter((c) => c.url.pathname.endsWith('/profile'))
      .every(
        (c) => c.headers.Authorization === 'Bearer ' + pair('b').accessToken,
      ),
  )
})
test('401 reads replay once after refresh; 401 writes are never replayed automatically', async () => {
  const f = setup()
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  let reads = 0,
    writes = 0,
    refreshes = 0
  f.handle((call) => {
    if (call.url.pathname.endsWith('/refresh'))
      return json(pair(String(++refreshes)))
    if (call.url.pathname.endsWith('/profile'))
      return ++reads === 1 ? json({}, 401) : json({ ok: true })
    if (call.url.pathname.endsWith('/orders')) {
      writes++
      return json({}, 401)
    }
  })
  await f.client.request('/v1/account/profile')
  assert.equal(reads, 2)
  await assert.rejects(
    f.client.request('/v1/orders', { method: 'POST', body: { requestId: id } }),
    (e) => e.status === 401,
  )
  assert.equal(writes, 1)
  assert.equal(refreshes, 2)
  assert.equal(f.client.getSnapshot().status, 'authenticated')
})
test('failed shared refresh clears identity without a retry loop', async () => {
  const f = setup()
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  f.advance(50000)
  let refreshes = 0
  f.handle((call) => {
    if (call.url.pathname.endsWith('/refresh')) {
      refreshes++
      return json({}, 401)
    }
  })
  const results = await Promise.allSettled([
    f.client.request('/v1/account/profile'),
    f.client.request('/v1/account/profile'),
  ])
  assert(results.every((r) => r.status === 'rejected'))
  assert.equal(refreshes, 1)
  assert.equal(f.client.getSnapshot().user, null)
})
test('logout during refresh revokes the late token and never restores identity', async () => {
  const f = setup()
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  f.advance(50000)
  const gate = deferred()
  f.handle(async (call) =>
    call.url.pathname.endsWith('/refresh') ? await gate.promise : undefined,
  )
  const read = f.client.request('/v1/account/profile')
  const rejected = assert.rejects(read)
  await new Promise((r) => setTimeout(r, 0))
  const logout = f.client.signOut()
  gate.resolve(json(pair('b')))
  await logout
  await rejected
  assert.equal(f.client.getSnapshot().status, 'anonymous')
  const revoked = f.calls
    .filter((c) => c.url.pathname.endsWith('/logout'))
    .map((c) => c.data.refreshToken)
  assert(revoked.includes(pair().refreshToken))
  assert(revoked.includes(pair('b').refreshToken))
})
test('late sign-in response after logout cannot resurrect a session', async () => {
  const gate = deferred()
  const f = setup({
    handler: async (call) =>
      call.url.pathname.endsWith('/login') ? await gate.promise : undefined,
  })
  const login = f.client.signIn({
    email: user.email,
    password: 'fixture-password',
  })
  const rejected = assert.rejects(login)
  await f.client.signOut()
  gate.resolve(json(pair()))
  await rejected
  assert.equal(f.client.getSnapshot().user, null)
  assert(f.calls.some((c) => c.url.pathname.endsWith('/logout')))
})
test('rate-limit and timeout errors remain actionable; neither retries a public write', async () => {
  const f = setup({
    timeoutMs: 15,
    handler: (call) =>
      call.url.pathname.endsWith('/limited')
        ? json({}, 429, { 'Retry-After': '60' })
        : call.url.pathname.endsWith('/slow')
          ? new Promise((resolve, reject) =>
              call.signal.addEventListener('abort', () =>
                reject(new Error('aborted')),
              ),
            )
          : undefined,
  })
  await assert.rejects(
    f.client.request('/v1/limited', { method: 'POST', auth: false }),
    (e) => e.status === 429 && e.retryAfterSeconds === 60,
  )
  await assert.rejects(
    f.client.request('/v1/slow', { method: 'POST', auth: false }),
    (e) => e.status === 408,
  )
  assert.equal(f.calls.length, 2)
})
test('fresh identity updates permissions without accepting a different user subject', async () => {
  const staff = {
    ...user,
    role: 'STAFF',
    staffRole: 'SUPPORT',
    permissions: ['orders.manage'],
  }
  const f = setup({
    audience: 'staff',
    handler: (call) =>
      call.url.pathname.endsWith('/login')
        ? json(pair('a', staff))
        : call.url.pathname.endsWith('/me')
          ? json(staff)
          : undefined,
  })
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  assert.equal(f.client.can('orders.manage'), true)
  f.handle((call) =>
    call.url.pathname.endsWith('/me')
      ? json({ ...staff, permissions: [] })
      : undefined,
  )
  await f.client.refreshIdentity()
  assert.equal(f.client.can('orders.manage'), false)
  f.handle((call) =>
    call.url.pathname.endsWith('/me')
      ? json({ ...staff, id: '00000000-0000-4000-8000-000000000002' })
      : undefined,
  )
  await assert.rejects(f.client.refreshIdentity())
  assert.equal(f.client.getSnapshot().status, 'anonymous')
})

test('incorrect current password does not rotate or destroy an otherwise valid session', async () => {
  const f = setup()
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  let refreshes = 0
  f.handle((call) => {
    if (call.url.pathname.endsWith('/refresh')) {
      refreshes++
      return json(pair('b'))
    }
    if (call.url.pathname.endsWith('/change-password')) return json({}, 401)
  })
  await assert.rejects(
    f.client.request('/v1/auth/change-password', {
      method: 'POST',
      refreshOn401: false,
      body: { currentPassword: 'wrong-password', newPassword: 'new-password' },
    }),
    (e) => e.status === 401,
  )
  assert.equal(refreshes, 0)
  assert.equal(f.client.getSnapshot().status, 'authenticated')
})

test('persistent bootstrap restores current identity once without receiving a refresh token', async () => {
  let refreshes = 0
  const session = {
    exchange: async (action) => {
      if (action === 'refresh') {
        refreshes++
        await new Promise((r) => setTimeout(r, 5))
        return cookiePair()
      }
      return { loggedOut: true }
    },
  }
  const client = createApiClient({
    audience: 'customer',
    baseUrl: () => 'https://api.example.test',
    session,
    fetch: async () => json(user),
  })
  const first = client.restoreSession(),
    second = client.restoreSession()
  assert.equal(client.getSnapshot().status, 'checking')
  await Promise.all([first, second])
  assert.equal(refreshes, 1)
  assert.equal(client.getSnapshot().status, 'authenticated')
  assert.equal(client.getSnapshot().user.id, user.id)
  assert.doesNotMatch(
    JSON.stringify(client.getSnapshot()),
    /accessToken|refreshToken/,
  )
})
test('logout during cookie bootstrap cannot resurrect login and revokes the late session', async () => {
  const gate = deferred()
  let revokes = 0
  const client = createApiClient({
    audience: 'customer',
    baseUrl: () => 'https://api.example.test',
    session: {
      exchange: async (action) => {
        if (action === 'refresh') return gate.promise
        if (action === 'logout') revokes++
        return { loggedOut: true }
      },
    },
    fetch: async () => json(user),
  })
  const restore = client.restoreSession(),
    logout = client.signOut()
  gate.resolve(cookiePair())
  await Promise.all([restore, logout])
  assert.equal(client.getSnapshot().status, 'anonymous')
  assert(revokes >= 1)
})
test('cookie restore handles absence and rejects any leaked refresh secret', async () => {
  for (const response of [null, pair()]) {
    const client = createApiClient({
      audience: 'customer',
      baseUrl: () => 'https://api.example.test',
      session: {
        exchange: async () => {
          if (!response) throw new ApiRequestError(401, 'No session')
          return response
        },
      },
      fetch: async () => json(user),
    })
    await client.restoreSession()
    assert.equal(client.getSnapshot().status, 'anonymous')
  }
})

test('external tab session change drops late identity without revoking the new shared cookie', async () => {
  const gate = deferred()
  let revokes = 0
  const client = createApiClient({
    audience: 'customer',
    baseUrl: () => 'https://api.example.test',
    session: {
      exchange: async (action) => {
        if (action === 'refresh') return gate.promise
        if (action === 'logout') revokes++
        return { loggedOut: true }
      },
    },
    fetch: async () => json(user),
  })
  const restoring = client.restoreSession()
  client.clearLocalSession()
  gate.resolve(cookiePair())
  await restoring
  assert.equal(client.getSnapshot().status, 'anonymous')
  assert.equal(revokes, 0)
})

test('public catalog reads remain independent of private-session logout cancellation', async () => {
  const gate = deferred()
  const f = setup({
    handler: (call) =>
      call.url.pathname === '/v1/products' ? gate.promise : undefined,
  })
  await f.client.signIn({ email: user.email, password: 'fixture-password' })
  const reading = f.client.request('/v1/products', { auth: false })
  await f.client.signOut()
  gate.resolve(json({ items: [], total: 0 }))
  assert.deepEqual(await reading, { items: [], total: 0 })
})
