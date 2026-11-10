import { isPreviewMode } from '@/lib/integration-mode'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Cart and private account surfaces remain excluded from indexing.
export const metadata: Metadata = {
  title: isPreviewMode ? 'Tracking Preview' : 'Order tracking',
  description: isPreviewMode
    ? 'Explore sample order tracking timelines. Real shipments are not connected.'
    : 'Track delivery and returns for your own order UUID.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
