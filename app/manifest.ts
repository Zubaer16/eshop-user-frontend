import type { MetadataRoute } from 'next'

/** Visual install metadata only. This preview is not an offline-capable PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'eShop Storefront Preview',
    short_name: 'eShop',
    description:
      'Multi-category storefront UI preview. No live orders or payments.',
    start_url: '/',
    display: 'browser',
    background_color: '#FFFFFF',
    theme_color: '#2459E8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
