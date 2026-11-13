import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Cart and private account surfaces remain excluded from indexing.
export const metadata: Metadata = {
  title: 'Shopping Cart',
  description: 'Review current server prices and availability before checkout.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
