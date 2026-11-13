import { Suspense } from 'react'
import { SecuritySettings } from '@/components/auth/security-settings'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <SecuritySettings />
    </Suspense>
  )
}
