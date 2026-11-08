import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { AccountLayout as AccountLayoutBoundary } from '@/components/auth/account-layout'
import { AccountShell } from '@/components/account/account-shell'

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <AccountLayoutBoundary preview={<AccountShell>{children}</AccountShell>}>
      {children}
    </AccountLayoutBoundary>
  )
}
