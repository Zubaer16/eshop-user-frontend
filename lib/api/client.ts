'use client'
import { apiOrigin, createApiClient } from './runtime'
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
