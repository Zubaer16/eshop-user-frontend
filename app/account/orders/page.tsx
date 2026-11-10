import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveOrderHistory } from '@/components/orders/orders'
import PreviewPage from '@/components/preview/pages/account-orders'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveOrderHistory />
    </Suspense>
  )
}
