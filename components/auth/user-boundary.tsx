'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { isPreviewMode } from '@/lib/integration-mode'
import { RequireAuth } from './auth-provider'
import { SecuritySettings } from './security-settings'
import { AccountHome, LiveAddresses } from '@/components/shopping/account'
import { LiveCartPage, LiveWishlist } from '@/components/shopping/cart'
import { LiveCheckout } from '@/components/shopping/checkout'
import {
  LiveOrderHistory,
  LiveOrderDetail,
  LiveTracking,
} from '@/components/orders/orders'
import { LiveInbox } from '@/components/notifications/inbox'
import {
  LiveStoreHome,
  LiveCollection,
  LivePolicy,
} from '@/components/store/live-store'
export function UserBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (
    isPreviewMode ||
    [
      '/sign-in',
      '/sign-up',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/shop',
      '/categories',
    ].includes(pathname) ||
    pathname.startsWith('/product/')
  )
    return children
  if (pathname === '/account')
    return (
      <RequireAuth>
        <AccountHome />
      </RequireAuth>
    )
  if (pathname === '/account/addresses')
    return (
      <RequireAuth>
        <LiveAddresses />
      </RequireAuth>
    )
  if (pathname === '/cart') return <LiveCartPage />
  if (pathname === '/') return <LiveStoreHome />
  if (pathname.startsWith('/collections/'))
    return (
      <LiveCollection
        key={pathname}
        slug={pathname.slice('/collections/'.length)}
      />
    )
  if (pathname.startsWith('/policies/'))
    return <LivePolicy kind={pathname.slice('/policies/'.length)} />
  if (pathname === '/account/notifications')
    return (
      <RequireAuth>
        <LiveInbox />
      </RequireAuth>
    )
  if (pathname === '/account/orders')
    return (
      <RequireAuth>
        <LiveOrderHistory />
      </RequireAuth>
    )
  if (pathname.startsWith('/account/orders/'))
    return (
      <RequireAuth>
        <LiveOrderDetail
          key={pathname}
          id={pathname.slice('/account/orders/'.length)}
        />
      </RequireAuth>
    )
  if (pathname === '/track')
    return (
      <RequireAuth>
        <LiveTracking />
      </RequireAuth>
    )
  if (pathname === '/checkout')
    return (
      <RequireAuth>
        <LiveCheckout />
      </RequireAuth>
    )
  if (pathname === '/wishlist')
    return (
      <RequireAuth>
        <LiveWishlist />
      </RequireAuth>
    )
  if (pathname === '/account/settings')
    return (
      <RequireAuth>
        <SecuritySettings />
      </RequireAuth>
    )
  const known =
    pathname === '/' ||
    [
      '/account',
      '/shop',
      '/categories',
      '/product',
      '/cart',
      '/checkout',
      '/wishlist',
      '/track',
    ].some((route) => pathname === route || pathname.startsWith(route + '/'))
  if (!known) return children
  const pending = (
    <section className="container-shell py-14">
      <h1 className="text-3xl font-black">This section is not available yet</h1>
      <p className="mt-4 max-w-xl text-slate-600">
        Shopping and account features are being connected. No sample orders or
        purchases are shown as live data.
      </p>
      <Link
        href="/account"
        className="mt-6 inline-block font-bold text-primary"
      >
        Your account
      </Link>
    </section>
  )
  return pathname.startsWith('/account/') ||
    ['/checkout', '/wishlist', '/track'].includes(pathname) ? (
    <RequireAuth>{pending}</RequireAuth>
  ) : (
    pending
  )
}
