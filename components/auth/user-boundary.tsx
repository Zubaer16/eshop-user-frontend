'use client'
import { usePathname } from 'next/navigation'
import { RequireAuth } from './auth-provider'
export function UserBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    ['/checkout', '/wishlist', '/track'].includes(pathname)
  ) {
    return <RequireAuth>{children}</RequireAuth>
  }
  return children
}
