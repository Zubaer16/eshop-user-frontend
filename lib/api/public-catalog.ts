import { cache } from 'react'
import { apiOrigin } from './runtime'
import { readProduct, slugSegment } from './catalog'
export const publicProduct = cache(async (slug: string) => {
  slugSegment(slug)
  const base = apiOrigin(
    process.env.ESHOP_API_URL ??
      process.env.NEXT_PUBLIC_ESHOP_API_URL ??
      process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
    process.env.NODE_ENV === 'production',
  )
  const response = await fetch(base + '/v1/products/' + slug, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error('Product service is temporarily unavailable.')
  return readProduct(await response.json())
})
