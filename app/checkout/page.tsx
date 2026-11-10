import { Suspense } from 'react'
import { isPreviewMode } from '@/lib/integration-mode'
import { LiveCheckout } from '@/components/shopping/checkout'
import PreviewPage from '@/components/preview/pages/checkout'
import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: isPreviewMode ? 'Checkout Preview' : 'Checkout',
  description: isPreviewMode
    ? 'Preview eShop checkout.'
    : 'Review delivery, server totals and TEST payment options.',
  robots: { index: false, follow: false },
}
export default function Page() {
  if (isPreviewMode) return <PreviewPage />
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <LiveCheckout />
    </Suspense>
  )
}
