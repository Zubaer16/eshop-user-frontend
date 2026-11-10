import { Suspense } from 'react'
import { LiveInbox } from '@/components/notifications/inbox'
import { isPreviewMode } from '@/lib/integration-mode'
export default function Page() {
  if (isPreviewMode) return <p>Inbox is available in live mode.</p>
  return (
    <Suspense fallback={<p role="status">Loading inbox...</p>}>
      <LiveInbox />
    </Suspense>
  )
}
