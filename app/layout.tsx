import type { Metadata, Viewport } from 'next'
import './globals.css'
import { UserBoundary } from '@/components/auth/user-boundary'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Providers } from '@/components/layout/providers'
import { imageUrl } from '@/lib/api/catalog'
import {
  publicCategories,
  publicBootstrap,
  publicOperations,
} from '@/lib/api/public-catalog'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const data = await publicBootstrap(),
      title = data.content.seoTitle || data.profile.storeName || 'eShop',
      icon = imageUrl(data.branding.favicon?.url)
    return {
      title: {
        default: title,
        template: '%s | ' + (data.profile.storeName || 'eShop'),
      },
      description: data.content.seoDescription || undefined,
      applicationName: data.profile.storeName || 'eShop',
      openGraph: {
        title,
        description: data.content.seoDescription || undefined,
        type: 'website',
      },
      ...(icon ? { icons: { icon } } : {}),
      robots: { index: false, follow: false },
    }
  } catch {
    return {
      title: { default: 'eShop', template: '%s | eShop' },
      robots: { index: false, follow: false },
    }
  }
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2459e8',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [initialCategories, initialBootstrap, initialOperations] =
    await Promise.all([
      publicCategories().catch(() => null),
      publicBootstrap().catch(() => null),
      publicOperations().catch(() => null),
    ])
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Providers
          initialCategories={initialCategories}
          initialBootstrap={initialBootstrap}
          initialOperations={initialOperations}
          categoriesExpiresAt={Date.now() + 30000}
        >
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
