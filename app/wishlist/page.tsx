import { Suspense } from 'react'
import { WishlistPage } from '@/components/shopping/cart'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <WishlistPage />
    </Suspense>
  )
}
