import type { Metadata } from 'next'
import { RecoveryForm } from '@/components/auth/recovery-form'
export const metadata: Metadata = {
  title: 'Verify email',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export default function Page() {
  return <RecoveryForm key="verify" mode="verify" />
}
