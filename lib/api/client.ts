'use client'
import { apiOrigin, createApiClient, type RequestOptions } from './runtime'
import { createAccountCache } from '../account-cache'
import {
  announceSession,
  createBrowserSession,
  sessionChannelName,
} from './browser-session'
export { sessionSource } from './browser-session'
export { ApiRequestError, safeReturnTo } from './runtime'
export function apiBaseUrl() {
  return apiOrigin(
    process.env.NEXT_PUBLIC_ESHOP_API_URL ??
      process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
    process.env.NODE_ENV === 'production',
  )
}
export const authChannelName = sessionChannelName('customer')
export const api = createApiClient({
  audience: 'customer',
  baseUrl: apiBaseUrl,
  session: createBrowserSession('customer'),
  onLogout: () => announceSession('customer', 'logout'),
  onLogin: () => announceSession('customer', 'login'),
})
export const accountData = createAccountCache({
  session: api.getSnapshot,
  request: (route, query) => api.request(route, { query }),
})
api.subscribe(accountData.syncSession)
const request = api.request
api.request = async function <T>(route: string, options: RequestOptions = {}) {
  const owner = api.getSnapshot()
  try {
    return await request<T>(route, options)
  } finally {
    const current = api.getSnapshot()
    if (
      options.method &&
      options.method !== 'GET' &&
      current.epoch === owner.epoch &&
      current.user?.id === owner.user?.id
    ) {
      if (route.startsWith('/v1/account/addresses'))
        accountData.invalidate('/v1/account/addresses')
      else if (
        route.startsWith('/v1/account/') ||
        route === '/v1/auth/email-verification/confirm'
      )
        accountData.invalidate('/v1/account/profile')
      if (route === '/v1/notifications/preferences')
        accountData.invalidate(route)
      if (
        /^\/v1\/(?:orders|payments|checkout\/(?:start|orders|reservations))(?:\/|$)/.test(
          route,
        )
      ) {
        accountData.invalidate('/v1/orders')
        accountData.invalidate('/v1/payments/orders')
      }
    }
  }
}
export const apiRequest = api.request

const sessionSignOut = api.signOut
api.signOut = async () => {
  const ticket = api.getSnapshot()
  if (typeof window !== 'undefined') {
    const push = await import('./browser-push')
    await push.revokeBrowserPush().catch(() => push.pauseBrowserPush())
  }
  if (
    api.getSnapshot().epoch !== ticket.epoch ||
    api.getSnapshot().user?.id !== ticket.user?.id
  )
    return false
  return sessionSignOut()
}
