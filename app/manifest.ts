import type { MetadataRoute } from 'next'
import { isPreviewMode } from '@/lib/integration-mode'

/** Visual install metadata only. This preview is not an offline-capable PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: isPreviewMode ? 'eShop Storefront Preview' : 'eShop',
    short_name: 'eShop',
    description: isPreviewMode
      ? 'Multi-category storefront UI preview. No live orders or payments.'
      : 'eShop storefront and your account.',
    start_url: '/',
    display: 'browser',
    background_color: '#FFFFFF',
    theme_color: '#2459E8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
