import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Authentication pages are excluded from indexing.
export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your eShop customer account.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
