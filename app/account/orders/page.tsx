import { Suspense } from 'react'
import { OrderHistory } from '@/components/orders/orders'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <OrderHistory />
    </Suspense>
  )
}
