import type { Metadata } from 'next'
import { RecoveryForm } from '@/components/auth/recovery-form'
export const metadata: Metadata = {
  title: 'New password',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export default function Page() {
  return <RecoveryForm key="reset" mode="reset" />
}
