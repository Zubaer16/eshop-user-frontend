import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Authentication pages are excluded from indexing.
export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your eShop customer account with email and password.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
