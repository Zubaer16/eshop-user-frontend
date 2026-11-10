import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveCartPage } from '@/components/shopping/cart'
import PreviewPage from '@/components/preview/pages/cart'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveCartPage />
    </Suspense>
  )
}
