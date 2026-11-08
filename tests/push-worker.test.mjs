import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
function fixture(initial) {
  let saved = initial
  const handlers = {},
    shown = [],
    opened = []
  const db = {
    close() {},
    transaction() {
      const tx = {
        objectStore: () => ({
          get: () => request(saved),
          put: (value) => {
            saved = value
            return request(value)
          },
        }),
      }
      function request(value) {
        const r = { result: value }
        queueMicrotask(() => {
          r.onsuccess?.()
          tx.oncomplete?.()
        })
        return r
      }
      return tx
    },
  }
  const self = {
    location: { origin: 'https://shop.example.test' },
    skipWaiting() {},
    clients: {
      claim() {},
      async openWindow(url) {
        opened.push(url)
      },
    },
    registration: {
      async showNotification(title, options) {
        shown.push({ title, options })
      },
    },
    addEventListener: (name, fn) => {
      handlers[name] = fn
    },
  }
  const indexedDB = {
    open() {
      const r = { result: db }
      queueMicrotask(() => r.onsuccess())
      return r
    },
  }
  runInNewContext(
    readFileSync(
      new URL('../public/eshop-push-worker.js', import.meta.url),
      'utf8',
    ),
    { self, indexedDB, URL, encodeURIComponent, Promise },
  )
  return {
    shown,
    opened,
    setOwner: (value) => (saved = value),
    async push(payload) {
      let work
      handlers.push({
        data: { json: () => payload },
        waitUntil: (p) => (work = p),
      })
      await work
    },
    async click(data) {
      let work
      handlers.notificationclick({
        notification: { data, close() {} },
        waitUntil: (p) => (work = p),
      })
      await work
    },
  }
}
const id = '00000000-0000-4000-8000-000000000001'
test('disabled/logged-out worker never displays private push content', async () => {
  const f = fixture({ enabled: false, owner: 'old', surface: 'STOREFRONT' })
  await f.push({
    data: { deliveryId: id },
    notification: { title: 'Private order', body: 'Secret address' },
  })
  assert.equal(f.shown.length, 0)
})
test('worker shows generic content and resolves only a fixed owned-delivery entry route', async () => {
  const f = fixture({ enabled: true, owner: 'current', surface: 'STOREFRONT' })
  await f.push({
    data: { deliveryId: id },
    notification: { title: 'Sensitive title', body: 'Sensitive body' },
    fcmOptions: { link: 'https://evil.example' },
  })
  assert.equal(f.shown.length, 1)
  assert.ok(!JSON.stringify(f.shown).includes('Sensitive'))
  await f.click(f.shown[0].options.data)
  assert.equal(
    f.opened[0],
    'https://shop.example.test/account/notifications?delivery=' + id,
  )
  f.setOwner({ enabled: true, owner: 'other', surface: 'STOREFRONT' })
  await f.click(f.shown[0].options.data)
  assert.equal(f.opened.length, 1)
})
test('malformed delivery identifiers cannot become executable notification navigation', async () => {
  const f = fixture({ enabled: true, owner: 'current', surface: 'ADMIN' })
  await f.push({ data: { deliveryId: 'javascript:alert(1)' } })
  assert.equal(f.shown.length, 0)
})
