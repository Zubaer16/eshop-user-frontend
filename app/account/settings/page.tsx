import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { SecuritySettings } from '@/components/auth/security-settings'
import PreviewPage from '@/components/preview/pages/account-settings'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <SecuritySettings />
    </Suspense>
  )
}
