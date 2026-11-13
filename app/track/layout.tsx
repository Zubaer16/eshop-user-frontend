import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Cart and private account surfaces remain excluded from indexing.
export const metadata: Metadata = {
  title: 'Order tracking',
  description: 'Track delivery and returns for your own order UUID.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
