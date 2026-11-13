import { Suspense } from 'react'
import { Checkout } from '@/components/shopping/checkout'
import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review delivery, server totals and TEST payment options.',
  robots: { index: false, follow: false },
}
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <Checkout />
    </Suspense>
  )
}
