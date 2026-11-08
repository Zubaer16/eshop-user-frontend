/* Generic lock-screen content; navigation always rechecks the authenticated owned delivery. */
const openState = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('eshop-push-state', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('state')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
async function state(write) {
  const db = await openState()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', write ? 'readwrite' : 'readonly')
      const store = tx.objectStore('state')
      let result
      const request = write ? store.put(write, 'owner') : store.get('owner')
      request.onsuccess = () => {
        result = request.result
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ESHOP_PUSH_OWNER')
    event.waitUntil(
      state({
        enabled: event.data.enabled === true,
        owner: String(event.data.owner || ''),
        surface: event.data.surface === 'ADMIN' ? 'ADMIN' : 'STOREFRONT',
      }).then(() => event.ports[0]?.postMessage({ saved: true })),
    )
})
self.addEventListener('push', (event) =>
  event.waitUntil(
    (async () => {
      const current = await state()
      if (!current?.enabled || !current.owner) return
      let payload
      try {
        payload = event.data.json()
      } catch {
        return
      }
      const id = payload?.data?.deliveryId
      if (
        typeof id !== 'string' ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
      )
        return
      await self.registration.showNotification('eShop', {
        body: 'You have a new notification. Open your inbox to view it.',
        tag: id,
        data: {
          deliveryId: id,
          surface: current.surface,
          owner: current.owner,
        },
      })
    })(),
  ),
)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const current = await state(),
        data = event.notification.data
      if (!current?.enabled || current.owner !== data.owner) return
      const path =
        (data.surface === 'ADMIN'
          ? '/notifications'
          : '/account/notifications') +
        '?delivery=' +
        encodeURIComponent(data.deliveryId)
      await self.clients.openWindow(new URL(path, self.location.origin).href)
    })(),
  )
})
