import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveWishlist } from '@/components/shopping/cart'
import PreviewPage from '@/components/preview/pages/wishlist'

export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveWishlist />
    </Suspense>
  )
}
