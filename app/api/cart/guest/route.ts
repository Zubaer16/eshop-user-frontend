import { apiOrigin } from '@/lib/api/runtime'
import { createGuestCartHandler } from '@/lib/api/guest-cart-server'
import { createSessionHandler } from '@/lib/api/session-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const config = {
  apiOrigin: () =>
    apiOrigin(
      process.env.ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_ESHOP_API_URL ??
        process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
      process.env.NODE_ENV === 'production',
    ),
  production: process.env.NODE_ENV === 'production',
  appOrigin: () => process.env.ESHOP_APP_ORIGIN,
}
export const POST = createGuestCartHandler({
  ...config,
  restoreSession: createSessionHandler({ ...config, audience: 'customer' }),
})
