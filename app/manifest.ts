import type { MetadataRoute } from 'next'

/** Browser install metadata; offline checkout is not supported. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'eShop',
    short_name: 'eShop',
    description: 'eShop storefront and your account.',
    start_url: '/',
    display: 'browser',
    background_color: '#FFFFFF',
    theme_color: '#2459E8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
