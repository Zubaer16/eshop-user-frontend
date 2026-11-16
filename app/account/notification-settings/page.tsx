import type { Metadata } from 'next'
import { NotificationSettings } from '@/components/notifications/settings'

export const metadata: Metadata = { title: 'Notification settings' }

export default function Page() {
  return <NotificationSettings />
}
