import type { Metadata } from 'next'
import { OrderTracking } from '@/components/orders/orders'
export const metadata: Metadata = {
  title: 'Order Tracking',
  robots: { index: false, follow: false },
}
export default function Page() {
  return <OrderTracking />
}
