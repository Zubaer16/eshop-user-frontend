import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import './globals.css'
import { UserBoundary } from '@/components/auth/user-boundary'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Providers } from '@/components/layout/providers'
import { isPreviewMode } from '@/lib/integration-mode'
import { apiOrigin } from '@/lib/api/runtime'
import { imageUrl } from '@/lib/api/catalog'

const previewMetadata: Metadata = {
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
export async function generateMetadata(): Promise<Metadata> {
  if (isPreviewMode) return previewMetadata
  await connection()
  try {
    const origin = apiOrigin(
      process.env.ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
      process.env.NODE_ENV === 'production',
    )
    const response = await fetch(origin + '/v1/store/bootstrap', {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Unavailable')
    const data = await response.json(),
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
