import { isPreviewMode } from '@/lib/integration-mode'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Cart and private account surfaces remain excluded from indexing.
export const metadata: Metadata = {
  title: isPreviewMode ? 'Shopping Cart Preview' : 'Shopping Cart',
  description: isPreviewMode
    ? 'Review items saved in your eShop preview cart. No orders are processed.'
    : 'Review current server prices and availability before checkout.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
