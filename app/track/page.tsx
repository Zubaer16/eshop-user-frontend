import { LiveTracking } from '@/components/orders/orders'
import { isPreviewMode } from '@/lib/integration-mode'
import type { Metadata } from 'next'
import { TrackingClient } from '@/components/account/tracking-client'
export const metadata: Metadata = {
  title: isPreviewMode ? 'Sample Order Tracking' : 'Order Tracking',
  robots: { index: false, follow: false },
}
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>
}) {
  if (!isPreviewMode) return <LiveTracking />
  const { sample } = await searchParams
  return (
    <TrackingClient
      initialSample={typeof sample === 'string' ? sample : undefined}
    />
  )
}
