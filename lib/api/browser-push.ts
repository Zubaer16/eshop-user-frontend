import { api } from './client'
const surface = 'STOREFRONT'
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
export const pushConfigured = () =>
  Object.values(config).every(Boolean) && Boolean(vapidKey)
const idKey = 'eshop-push-installation',
  ownerKey = 'eshop-push-owner'
type Device = {
  id: string
  installationId: string
  surface: string
  status: string
  revision: number
}
async function worker(enabled: boolean, owner = '') {
  if (!('serviceWorker' in navigator)) return
  const registration =
    await navigator.serviceWorker.getRegistration('/eshop-push/')
  const target = registration?.active
  if (!target) return
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      clearTimeout(timer)
      channel.port1.close()
      resolve()
    }
    const timer = setTimeout(() => {
      channel.port1.close()
      resolve()
    }, 3000)
    target.postMessage({ type: 'ESHOP_PUSH_OWNER', enabled, owner, surface }, [
      channel.port2,
    ])
  })
}
async function messaging() {
  if (!pushConfigured())
    throw new Error('Browser push is not configured for this deployment.')
  const [{ initializeApp, getApps }, sdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])
  if (!(await sdk.isSupported()))
    throw new Error('Push is unavailable in this browser.')
  const app =
    getApps().find((a) => a.name === 'eshop-web-push') ||
    initializeApp(config, 'eshop-web-push')
  return { sdk, value: sdk.getMessaging(app) }
}
function guard(subject: string, epoch: number) {
  if (
    api.getSnapshot().epoch !== epoch ||
    api.getSnapshot().status !== 'authenticated' ||
    api.getSnapshot().user?.id !== subject
  )
    throw new Error('The account changed. Reopen notification settings.')
}
let queue: Promise<unknown> = Promise.resolve()
function lock<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (navigator.locks)
      return await navigator.locks.request('eshop-push-session', task)
    return await task()
  }
  const value = queue.then(run, run)
  queue = value.catch(() => undefined)
  return value
}
export function pauseBrowserPush() {
  if (typeof navigator !== 'undefined')
    void worker(false).catch(() => undefined)
}
export function enableBrowserPush(explicit = true) {
  const subject = api.getSnapshot().user?.id,
    epoch = api.getSnapshot().epoch
  // Start the permission prompt directly from the user's click, before network/lock awaits.
  const permission =
    explicit &&
    subject &&
    pushConfigured() &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window
      ? Notification.requestPermission()
      : Promise.resolve(null)
  return lock(async () => {
    if (!subject) throw new Error('Sign in to enable notifications.')
    guard(subject, epoch)
    if (!pushConfigured())
      throw new Error('Browser push deployment configuration is missing.')
    if (!window.isSecureContext || !('Notification' in window))
      throw new Error('Push requires a supported secure browser.')
    const status = await api.request<{ registrationConfigured: boolean }>(
      '/v1/notifications/push/config',
    )
    guard(subject, epoch)
    if (!status.registrationConfigured)
      throw new Error('Backend push registration is not configured.')
    if (explicit) {
      if ((await permission) !== 'granted')
        throw new Error('Notification permission was not granted.')
    } else if (
      Notification.permission !== 'granted' ||
      localStorage.getItem(ownerKey) !== subject
    )
      return
    guard(subject, epoch)
    const { sdk, value } = await messaging()
    guard(subject, epoch)
    await worker(false)
    if (localStorage.getItem(ownerKey) !== subject)
      await sdk.deleteToken(value).catch(() => false)
    guard(subject, epoch)
    await navigator.serviceWorker.register('/eshop-push-worker.js', {
      scope: '/eshop-push/',
    })
    const registration =
      await navigator.serviceWorker.getRegistration('/eshop-push/')
    if (!registration)
      throw new Error('Notification worker registration failed.')
    if (!registration.active)
      await new Promise<void>((resolve, reject) => {
        const w = registration.installing || registration.waiting
        if (!w) {
          reject(new Error('Worker is not active.'))
          return
        }
        const timer = setTimeout(
          () => reject(new Error('Worker activation timed out.')),
          10000,
        )
        w.addEventListener('statechange', () => {
          if (w.state === 'activated') {
            clearTimeout(timer)
            resolve()
          }
        })
      })
    guard(subject, epoch)
    let installationId = localStorage.getItem(idKey)
    if (!installationId) {
      installationId = crypto.randomUUID()
      localStorage.setItem(idKey, installationId)
    }
    const devices = await api.request<Device[]>(
      '/v1/notifications/push/devices',
    )
    guard(subject, epoch)
    const current = devices.find(
      (d) => d.installationId === installationId && d.surface === surface,
    )
    if (!explicit && (!current || current.status !== 'ACTIVE')) {
      localStorage.removeItem(ownerKey)
      await sdk.deleteToken(value).catch(() => false)
      return
    }
    const token = await sdk.getToken(value, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    guard(subject, epoch)
    if (!token)
      throw new Error('The push provider did not return a registration token.')
    await api.request('/v1/notifications/push/devices', {
      method: 'POST',
      body: {
        installationId,
        expectedRevision: current?.revision || 0,
        surface,
        identifierKind: 'REGISTRATION_TOKEN',
        permission: 'GRANTED',
        token,
      },
    })
    guard(subject, epoch)
    localStorage.setItem(ownerKey, subject)
    await worker(true, subject)
    return true
  })
}
export async function revokeBrowserPush() {
  const subject = api.getSnapshot().user?.id,
    epoch = api.getSnapshot().epoch
  return lock(async () => {
    if (
      api.getSnapshot().epoch !== epoch ||
      api.getSnapshot().user?.id !== subject
    )
      return
    await worker(false)
    const existed = Boolean(localStorage.getItem(idKey))
    let failure: unknown
    try {
      if (subject && localStorage.getItem(idKey)) {
        const installation = localStorage.getItem(idKey),
          devices = await api.request<Device[]>(
            '/v1/notifications/push/devices',
          )
        guard(subject, epoch)
        for (const device of devices.filter(
          (d) =>
            d.installationId === installation &&
            d.surface === surface &&
            d.status === 'ACTIVE',
        )) {
          guard(subject, epoch)
          await api.request('/v1/notifications/push/devices/' + device.id, {
            method: 'DELETE',
            query: { expectedRevision: device.revision },
          })
        }
      }
    } catch (e) {
      failure = e
    } finally {
      localStorage.removeItem(ownerKey)
      if (existed && pushConfigured()) {
        const { sdk, value } = await messaging()
        await sdk.deleteToken(value).catch(() => false)
      }
    }
    if (failure) throw failure
  })
}
export function restoreBrowserPush() {
  try {
    const subject = api.getSnapshot().user?.id
    if (!subject) {
      pauseBrowserPush()
      return
    }
    if (pushConfigured() && localStorage.getItem(ownerKey) === subject)
      void enableBrowserPush(false).catch(() => pauseBrowserPush())
    else pauseBrowserPush()
  } catch {
    pauseBrowserPush()
  }
}
