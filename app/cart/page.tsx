import { Suspense } from 'react'
import { CartPage } from '@/components/shopping/cart'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <CartPage />
    </Suspense>
  )
}
