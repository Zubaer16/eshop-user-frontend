import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveAddresses } from '@/components/shopping/account'
import PreviewPage from '@/components/preview/pages/account-addresses'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveAddresses />
    </Suspense>
  )
}
