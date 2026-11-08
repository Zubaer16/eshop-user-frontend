import { apiOrigin } from '@/lib/api/runtime'
import { createSessionHandler } from '@/lib/api/session-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = createSessionHandler({
  audience: 'customer',
  apiOrigin: () =>
    apiOrigin(
      process.env.ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
      process.env.NODE_ENV === 'production',
    ),
  production: process.env.NODE_ENV === 'production',
  appOrigin: () => process.env.ESHOP_APP_ORIGIN,
})
