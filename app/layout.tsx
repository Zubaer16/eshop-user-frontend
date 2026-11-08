import type { Metadata, Viewport } from 'next'
import './globals.css'
import { UserBoundary } from '@/components/auth/user-boundary'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Providers } from '@/components/layout/providers'

export const metadata: Metadata = {
  title: {
    default: 'eShop | Everyday Finds, Extraordinary Living',
    template: '%s | eShop',
  },
  description:
    'Discover thoughtfully picked everyday essentials, tech, fashion, home goods and more. eShop storefront preview.',
  applicationName: 'eShop',
  openGraph: {
    title: 'eShop | Storefront Preview',
    description:
      'Explore a multi-category shopping experience. Preview only; shopping is not yet available; customer sign-in is available.',
    type: 'website',
  },
  robots: { index: false, follow: false }, // Preview only: enable indexing after live catalog and SEO are ready.
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2459e8',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Providers>
          <Header />
          <main id="main-content" tabIndex={-1} className="min-h-[55vh]">
            <UserBoundary>{children}</UserBoundary>
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
