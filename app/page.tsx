import { Suspense } from 'react'
import { StoreHome } from '@/components/store/store-content'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <StoreHome />
    </Suspense>
  )
}
