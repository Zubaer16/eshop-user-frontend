import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Frontend-only screen: do not index or imply a live commerce service.
export const metadata: Metadata = {
  title: 'Sign In Preview',
  description: 'Sign in to your eShop customer account.',
  robots: { index: false, follow: false },
}

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return children
}
