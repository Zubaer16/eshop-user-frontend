import type { NextConfig } from 'next'

const development = process.env.NODE_ENV !== 'production'
const apiUrl =
  process.env.NEXT_PUBLIC_ESHOP_API_URL ??
  process.env.NEXT_PUBLIC_KOOKABURRA_API_URL
const apiOrigin = apiUrl ? new URL(apiUrl).origin : ''
const policy = [
  "default-src 'self'",
  // Static Next.js hydration contains inline scripts. Event handlers stay blocked.
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com${development ? ' ws: wss:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  ...(!development ? ['upgrade-insecure-requests'] : []),
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: policy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
