import { Suspense } from 'react'
import { Addresses } from '@/components/shopping/account'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <Addresses />
    </Suspense>
  )
}
