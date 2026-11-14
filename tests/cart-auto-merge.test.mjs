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
function createHarness({
  guest = null,
  firstAccount = null,
  wishlistRequest,
} = {}) {
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
    request: wishlistRequest || (async () => ({ items: [], count: 0 })),
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

const wishItem = (n) => ({
  productId: uid(n),
  slug: 'product-' + n,
  title: 'Product ' + n,
  currency: 'USD',
  priceMinor: n * 100,
  addedAt: new Date().toISOString(),
})
const wishlistOf = (...items) => ({ items, count: items.length })
const gate = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('wishlist adds and removes immediately and successful mutations avoid a follow-up GET', async () => {
  const add = gate(),
    remove = gate()
  let reads = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) {
        reads++
        return wishlistOf()
      }
      await (options.method === 'PUT' ? add.promise : remove.promise)
      return options.method === 'PUT'
        ? wishlistOf(wishItem(1))
        : { removed: true }
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const saving = h.state().save(uid(1), true, wishItem(1))
    assert.equal(h.state().wishlist.count, 1)
    add.resolve()
    assert.equal(await saving, true)
    const removing = h.state().save(uid(1), false)
    assert.equal(h.state().wishlist.count, 0)
    remove.resolve()
    assert.equal(await removing, true)
    assert.equal(reads, 1)
  } finally {
    add.resolve()
    remove.resolve()
    h.close()
  }
})

test('rapid wishlist toggles keep the latest visible choice and coalesce a fulfilled final intent', async () => {
  const pending = gate()
  const writes = []
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) return wishlistOf()
      writes.push(options.method)
      await pending.promise
      return wishlistOf(wishItem(1))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const first = h.state().save(uid(1), true, wishItem(1))
    const second = h.state().save(uid(1), false)
    assert.equal(h.state().wishlist.count, 0)
    const third = h.state().save(uid(1), true, wishItem(1))
    assert.equal(h.state().wishlist.count, 1)
    pending.resolve()
    await Promise.all([first, second, third])
    assert.deepEqual(writes, ['PUT'])
    assert.equal(h.state().wishlist.count, 1)
  } finally {
    pending.resolve()
    h.close()
  }
})

test('an opposite queued wishlist intent follows the in-flight write in order', async () => {
  const pending = gate()
  const writes = []
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) return wishlistOf()
      writes.push(options.method)
      if (options.method === 'PUT') {
        await pending.promise
        return wishlistOf(wishItem(1))
      }
      return { removed: true }
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const first = h.state().save(uid(1), true, wishItem(1))
    const second = h.state().save(uid(1), false)
    assert.equal(h.state().wishlist.count, 0)
    pending.resolve()
    await Promise.all([first, second])
    assert.deepEqual(writes, ['PUT', 'DELETE'])
    assert.equal(h.state().wishlist.count, 0)
  } finally {
    pending.resolve()
    h.close()
  }
})

test('a canonical PUT response preserves another optimistic product while its write is queued', async () => {
  const one = gate(),
    two = gate()
  const h = createHarness({
    wishlistRequest: async (route, options) => {
      if (!options) return wishlistOf()
      if (route.endsWith(uid(1))) {
        await one.promise
        return wishlistOf(wishItem(1))
      }
      await two.promise
      return wishlistOf(wishItem(1), wishItem(2))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const first = h.state().save(uid(1), true, wishItem(1))
    const second = h.state().save(uid(2), true, wishItem(2))
    assert.equal(h.state().wishlist.count, 2)
    one.resolve()
    await settle()
    assert.equal(h.state().wishlist.count, 2)
    two.resolve()
    await Promise.all([first, second])
    assert.equal(h.state().wishlist.count, 2)
  } finally {
    one.resolve()
    two.resolve()
    h.close()
  }
})

test('a rejected wishlist write rolls back that product and remains retryable', async () => {
  let writes = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) return wishlistOf(wishItem(2))
      if (++writes === 1)
        throw Object.assign(new Error('Wishlist limit reached'), {
          status: 409,
        })
      return wishlistOf(wishItem(1), wishItem(2))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(await h.state().save(uid(1), true, wishItem(1)), false)
    assert.deepEqual(
      h.state().wishlist.items.map((item) => item.productId),
      [uid(2)],
    )
    assert.equal(h.state().wishError, 'Wishlist limit reached')
    assert.equal(await h.state().save(uid(1), true, wishItem(1)), true)
    assert.equal(h.state().wishError, '')
    assert.equal(h.state().wishlist.count, 2)
  } finally {
    h.close()
  }
})

test('a transport failure after commit reconciles wishlist state with an exceptional GET', async () => {
  let committed = false,
    reads = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) {
        reads++
        return committed ? wishlistOf(wishItem(1)) : wishlistOf()
      }
      committed = true
      throw Object.assign(new Error('Response lost'), { status: 503 })
    },
  })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(await h.state().save(uid(1), true, wishItem(1)), false)
    assert.equal(h.state().wishlist.count, 1)
    assert.equal(reads, 2)
    assert.equal(h.state().wishError, 'Response lost')
  } finally {
    h.close()
  }
})

test('an older wishlist GET cannot overwrite a completed optimistic write', async () => {
  const pending = gate()
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) {
        await pending.promise
        return wishlistOf()
      }
      return wishlistOf(wishItem(1))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(await h.state().save(uid(1), true, wishItem(1)), true)
    pending.resolve()
    await settle()
    assert.equal(h.state().wishlist.count, 1)
    assert.equal(h.state().wishLoading, false)
  } finally {
    pending.resolve()
    h.close()
  }
})

test('account switches fence old wishlist writes while the replacement account can save independently', async () => {
  const old = gate(),
    current = gate()
  let writes = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) return wishlistOf()
      if (++writes === 1) {
        await old.promise
        return wishlistOf(wishItem(1))
      }
      await current.promise
      return wishlistOf(wishItem(2))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const first = h.state().save(uid(1), true, wishItem(1))
    h.session(uid(92))
    await settle()
    assert.equal(h.state().wishlist.count, 0)
    const second = h.state().save(uid(2), true, wishItem(2))
    old.resolve()
    await first
    assert.deepEqual(
      h.state().wishlist.items.map((item) => item.productId),
      [uid(2)],
    )
    current.resolve()
    assert.equal(await second, true)
    assert.deepEqual(
      h.state().wishlist.items.map((item) => item.productId),
      [uid(2)],
    )
  } finally {
    old.resolve()
    current.resolve()
    h.close()
  }
})

test('an explicit wishlist refresh waits for pending intents and reads the settled server list', async () => {
  const pending = gate()
  let reads = 0,
    committed = false
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) {
        reads++
        return committed ? wishlistOf(wishItem(1)) : wishlistOf()
      }
      await pending.promise
      committed = true
      return wishlistOf(wishItem(1))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const saving = h.state().save(uid(1), true, wishItem(1))
    h.state().reload()
    await settle()
    assert.equal(reads, 1)
    assert.equal(h.state().wishlist.count, 1)
    pending.resolve()
    await saving
    await settle()
    assert.equal(reads, 2)
    assert.equal(h.state().wishlist.count, 1)
  } finally {
    pending.resolve()
    h.close()
  }
})

test('a cold failed wishlist add restores existing server items while ignoring the older initial read', async () => {
  const initial = gate()
  let reads = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) {
        if (++reads === 1) {
          await initial.promise
          return wishlistOf()
        }
        return wishlistOf(wishItem(2))
      }
      throw Object.assign(new Error('Product unavailable'), { status: 404 })
    },
  })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(await h.state().save(uid(1), true, wishItem(1)), false)
    assert.deepEqual(
      h.state().wishlist.items.map((item) => item.productId),
      [uid(2)],
    )
    initial.resolve()
    await settle()
    assert.deepEqual(
      h.state().wishlist.items.map((item) => item.productId),
      [uid(2)],
    )
    assert.equal(reads, 2)
  } finally {
    initial.resolve()
    h.close()
  }
})

test('the existing 100-product wishlist limit prevents an invalid optimistic addition', async () => {
  let writes = 0
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (options) writes++
      return wishlistOf(
        ...Array.from({ length: 100 }, (_, index) => wishItem(index + 1)),
      )
    },
  })
  try {
    h.session(uid(91))
    await settle()
    assert.equal(await h.state().save(uid(200), true, wishItem(200)), false)
    assert.equal(h.state().wishlist.count, 100)
    assert.equal(writes, 0)
    assert.equal(h.state().wishError, 'Wishlist cannot exceed 100 products')
  } finally {
    h.close()
  }
})

test('pausing readiness fences a pending wishlist write and restores a fresh server snapshot on resume', async () => {
  const pending = gate()
  let committed = false
  const h = createHarness({
    wishlistRequest: async (_route, options) => {
      if (!options) return committed ? wishlistOf(wishItem(1)) : wishlistOf()
      if (options.method === 'DELETE') return { removed: true }
      await pending.promise
      committed = true
      return wishlistOf(wishItem(1))
    },
  })
  try {
    h.session(uid(91))
    await settle()
    const saving = h.state().save(uid(1), true, wishItem(1))
    h.commerce.setReady(false)
    assert.equal(h.state().wishlist, null)
    pending.resolve()
    assert.equal(await saving, false)
    assert.equal(h.state().wishlist, null)
    h.commerce.setReady(true)
    await settle()
    assert.equal(h.state().wishlist.count, 1)
    assert.equal(await h.state().save(uid(1), false), true)
    assert.equal(h.state().wishlist.count, 0)
  } finally {
    pending.resolve()
    h.close()
  }
})
