import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
function deferred() {
  let resolve
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}
function moduleFrom(file, require, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText
  runInNewContext(code, {
    exports,
    require,
    setTimeout,
    clearTimeout,
    ...globals,
  })
  return exports
}
test('permission granted after an account switch cannot register/enable push for the replacement account', async () => {
  const permission = deferred()
  let state = { status: 'authenticated', epoch: 1, user: { id: 'account-A' } },
    sdkLoads = 0
  const requests = []
  const api = {
    getSnapshot: () => state,
    async request(route, options) {
      requests.push({ route, options })
      return { registrationConfigured: true }
    },
  }
  const Notification = {
    permission: 'default',
    requestPermission: () => permission.promise,
  }
  const push = moduleFrom(
    '../lib/api/browser-push.ts',
    (name) => {
      if (name === './client') return { api }
      sdkLoads++
      throw new Error('SDK must not load for a superseded account')
    },
    {
      process: {
        env: {
          NEXT_PUBLIC_FIREBASE_API_KEY: 'public',
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test',
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'test',
          NEXT_PUBLIC_FIREBASE_APP_ID: 'test',
          NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'test',
        },
      },
      window: { isSecureContext: true, Notification },
      Notification,
      navigator: { locks: { request: async (_name, work) => await work() } },
    },
  )
  const work = push.enableBrowserPush()
  await new Promise((r) => setImmediate(r))
  state = { status: 'authenticated', epoch: 2, user: { id: 'account-B' } }
  permission.resolve('granted')
  await assert.rejects(work, /account changed/i)
  assert.equal(sdkLoads, 0)
  assert.equal(requests.filter((r) => r.options?.method === 'POST').length, 0)
})
test('logout delayed by push cleanup cannot log out a newly signed-in account', async () => {
  const cleanup = deferred()
  let state = { status: 'authenticated', epoch: 1, user: { id: 'account-A' } },
    logouts = 0
  const api = {
    getSnapshot: () => state,
    request() {},
    async signOut() {
      logouts++
    },
  }
  const client = moduleFrom(
    '../lib/api/client.ts',
    (name) => {
      if (name === './runtime')
        return {
          createApiClient: () => api,
          apiOrigin: () => 'https://api.example.test',
        }
      if (name === './browser-session')
        return {
          createBrowserSession: () => ({}),
          announceSession() {},
          sessionChannelName: () => 'test',
          sessionSource: 'test',
        }
      if (name === './browser-push')
        return {
          revokeBrowserPush: () => cleanup.promise,
          pauseBrowserPush() {},
        }
      throw new Error('Unexpected import ' + name)
    },
    { window: {}, process: { env: { NODE_ENV: 'test' } } },
  )
  const logout = client.api.signOut()
  await new Promise((r) => setImmediate(r))
  state = { status: 'authenticated', epoch: 2, user: { id: 'account-B' } }
  cleanup.resolve()
  await logout
  assert.equal(logouts, 0)
  await client.api.signOut()
  assert.equal(logouts, 1)
})
