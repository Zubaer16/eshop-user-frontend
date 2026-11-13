import { Suspense } from 'react'
import { NotificationInbox } from '@/components/notifications/inbox'
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading inbox...</p>}>
      <NotificationInbox />
    </Suspense>
  )
}
