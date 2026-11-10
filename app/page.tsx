import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveStoreHome } from '@/components/store/live-store'
import PreviewPage from '@/components/preview/pages/home'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveStoreHome />
    </Suspense>
  )
}
