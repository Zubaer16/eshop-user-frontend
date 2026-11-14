import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')

// Exercise the real store and cart functions with a browser/session double.
// The unit suite does not require a live Backend, browser or database.
const source = (relative) =>
  ts.transpileModule(
    fs.readFileSync(new URL(relative, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText
const moduleFrom = (code, dependencies = {}) => {
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', code)(
    (name) => {
      if (!(name in dependencies))
        throw new Error('Unexpected dependency: ' + name)
      return dependencies[name]
    },
    loaded,
    loaded.exports,
  )
  return loaded.exports
}
const shopping = moduleFrom(source('../lib/api/shopping.ts'))
const local = moduleFrom(source('../lib/stores/local-cart.ts'), {
  '../api/shopping': shopping,
})
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const preview = {
  title: 'Headphones',
  sku: 'HEAD-1',
  currency: 'USD',
  unitPriceMinor: 3999,
  image: null,
}
const selection = { productId: uid(1), variantId: null, quantity: 1 }
const saveCart = (storage, key, cart) =>
  storage.setItem(key, JSON.stringify({ version: 1, cart }))
const quote = (amount = 1) =>
  local.addLocalItem(
    local.localQuote([]),
    { ...selection, quantity: amount },
    preview,
    uid(8),
  )
const settle = async () => {
  for (let i = 0; i < 10; i++)
    await new Promise((resolve) => setImmediate(resolve))
}
function createHarness({ guest = null, firstAccount = null } = {}) {
  const saved = new Map()
  const storage = {
    failSet: '',
    failRemove: '',
    getItem(key) {
      return saved.get(key) ?? null
    },
    setItem(key, value) {
      if (key === this.failSet) throw new Error('Storage unavailable')
      saved.set(key, value)
    },
    removeItem(key) {
      if (key === this.failRemove) throw new Error('Storage unavailable')
      saved.delete(key)
    },
  }
  const guestKey = local.cartStorageKey()
  if (guest) saveCart(storage, guestKey, guest)
  if (firstAccount)
    saveCart(storage, local.cartStorageKey(uid(91)), firstAccount)
  const listeners = new Set()
  let session = { status: 'anonymous', epoch: 1, user: null }
  const api = {
    getServerSnapshot: () => session,
    getSnapshot: () => session,
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    request: async () => ({ items: [], count: 0 }),
  }
  const createStore = (initializer) => {
    let state = initializer()
    return {
      getState: () => state,
      setState: (partial) => {
        state = { ...state, ...partial }
      },
    }
  }
  const previousWindow = globalThis.window
  const previousNavigator = globalThis.navigator
  globalThis.window = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: { locks: { request: async (_name, action) => action() } },
    configurable: true,
  })
  const { createCommerceStore } = moduleFrom(
    source('../lib/stores/shopping-store.ts'),
    {
      'zustand/vanilla': { createStore },
      '@/lib/api/client': { api },
      '@/lib/api/shopping': shopping,
      './local-cart': local,
    },
  )
  const commerce = createCommerceStore()
  const stop = commerce.start()
  commerce.setReady(true)
  return {
    storage,
    commerce,
    guestKey,
    state: () => commerce.store.getState(),
    session: (userId = null) => {
      session = {
        status: userId ? 'authenticated' : 'anonymous',
        epoch: session.epoch + 1,
        user: userId ? { id: userId } : null,
      }
      for (const cb of listeners) cb()
    },
    close: () => {
      stop()
      globalThis.window = previousWindow
      Object.defineProperty(globalThis, 'navigator', {
        value: previousNavigator,
        configurable: true,
      })
    },
  }
}

test('guest items automatically enter one account cart on sign-in and are not replayed on reload', async () => {
  const h = createHarness({ guest: quote(2), firstAccount: quote(1) })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(h.state().guestMergeError, '')
    assert.equal(h.state().cart.items.length, 1)
    assert.equal(h.state().cart.items[0].quantity, 3)
    assert.equal(h.storage.getItem(h.guestKey), null)
    h.state().reload()
    await settle()
    assert.equal(h.state().cart.items[0].quantity, 3)
    assert.equal(h.state().canAdd, true)
  } finally {
    h.close()
  }
})

test('account switch resets cart UI and never shows the previous account items', async () => {
  const h = createHarness({ guest: quote(2) })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(h.state().cart.items[0].quantity, 2)
    h.session()
    assert.equal(h.state().cart.items.length, 0)
    h.session(uid(92))
    await settle()
    assert.equal(h.state().cart.items.length, 0)
    assert.equal(
      local.decodeLocalCart(h.storage.getItem(local.cartStorageKey(uid(91))))
        .items[0].quantity,
      2,
    )
  } finally {
    h.close()
  }
})

test('failed account persistence preserves guest items and supports an explicit safe retry', async () => {
  const h = createHarness({ guest: quote(2) })
  try {
    h.storage.failSet = local.cartStorageKey(uid(91))
    h.session(uid(91))
    await settle()
    assert.match(h.state().guestMergeError, /Could not save/)
    assert.equal(h.state().loading, false)
    assert.ok(h.storage.getItem(h.guestKey))
    h.storage.failSet = ''
    h.state().retryGuestMerge()
    await settle()
    assert.equal(h.state().guestMergeError, '')
    assert.equal(h.state().cart.items[0].quantity, 2)
    assert.equal(h.storage.getItem(h.guestKey), null)
  } finally {
    h.close()
  }
})

test('an already-merged but uncleared guest cart cannot leak into another account', async () => {
  const h = createHarness({ guest: quote(2) })
  try {
    h.storage.failRemove = h.guestKey
    h.session(uid(91))
    await settle()
    assert.match(h.state().guestMergeError, /could not be cleared/)
    assert.equal(JSON.parse(h.storage.getItem(h.guestKey)).mergedTo, uid(91))
    h.storage.failRemove = ''
    h.session()
    h.session(uid(92))
    await settle()
    assert.equal(h.state().cart.items.length, 0)
    assert.equal(h.storage.getItem(h.guestKey), null)
  } finally {
    h.close()
  }
})

test('invalid combined quantity leaves guest snapshot intact instead of losing items', async () => {
  const h = createHarness({ guest: quote(5), firstAccount: quote(98) })
  try {
    h.session(uid(91))
    await settle()
    assert.match(h.state().guestMergeError, /1–99/)
    assert.equal(h.state().cart.items[0].quantity, 98)
    assert.ok(h.storage.getItem(h.guestKey))
  } finally {
    h.close()
  }
})

test('claimed guest items are hidden after logout; fresh guest shopping starts empty', async () => {
  const h = createHarness({ guest: quote(2) })
  try {
    h.storage.failRemove = h.guestKey
    h.session(uid(91))
    await settle()
    assert.equal(h.state().cart.items[0].quantity, 2)
    h.session()
    assert.equal(h.state().cart.items.length, 0)
    assert.equal(await h.state().add(selection, preview), true)
    assert.equal(h.state().cart.items[0].quantity, 1)
    assert.equal(JSON.parse(h.storage.getItem(h.guestKey)).mergedTo, undefined)
    h.storage.failRemove = ''
    h.session(uid(92))
    await settle()
    assert.equal(h.state().cart.items[0].quantity, 1)
    assert.equal(
      local.decodeLocalCart(h.storage.getItem(local.cartStorageKey(uid(91))))
        .items[0].quantity,
      2,
    )
  } finally {
    h.close()
  }
})
