import { Suspense } from 'react'
import { AccountHome } from '@/components/shopping/account'

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading...</p>}>
      <AccountHome />
    </Suspense>
  )
}
