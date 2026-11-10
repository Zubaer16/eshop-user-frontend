import { isPreviewMode } from '@/lib/integration-mode'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Cart and private account surfaces remain excluded from indexing.
export const metadata: Metadata = {
  title: isPreviewMode ? 'Wishlist Preview' : 'Saved items',
  description: isPreviewMode
    ? 'View your locally saved eShop preview products.'
    : 'View products saved to your eShop account.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
