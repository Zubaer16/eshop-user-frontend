import type { Metadata } from 'next'
import { AuthEntry } from '@/components/auth/auth-entry'
export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
}
export default function Page() {
  return <AuthEntry mode="sign-up" />
}
