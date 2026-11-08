import type { Metadata } from 'next'
import { RecoveryForm } from '@/components/auth/recovery-form'
export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export default function Page() {
  return <RecoveryForm key="forgot" mode="forgot" />
}
