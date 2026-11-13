import { cache } from 'react'
import { apiOrigin } from './runtime'
import {
  readProduct,
  readPage,
  shopQuery,
  slugSegment,
  type ShopQuery,
} from './catalog'
import type { Home, Collection } from '@/components/store/store-content'

async function publicRead(
  route: string,
  query: Record<string, string | number | undefined> = {},
) {
  const base = apiOrigin(
    process.env.ESHOP_API_URL ??
      process.env.NEXT_PUBLIC_ESHOP_API_URL ??
      process.env.NEXT_PUBLIC_KOOKABURRA_API_URL,
    process.env.NODE_ENV === 'production',
  )
  const url = new URL(base + route)
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) url.searchParams.set(key, String(value))
  const response = await fetch(url, {
    next: { revalidate: 30 },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok)
    throw new Error('Public store content is temporarily unavailable.')
  return response.json()
}
export const publicHomepage = cache(async () => {
  const data = (await publicRead('/v1/store/homepage')) as Home
  if (!Array.isArray(data.banners) || !Array.isArray(data.collections))
    throw new Error('Invalid homepage response.')
  return data
})
export async function publicShop(params: ShopQuery) {
  return readPage(
    await publicRead('/v1/products', shopQuery(params)),
    readProduct,
  )
}
export const publicCollection = cache(async (slug: string) => {
  slugSegment(slug)
  const data = (await publicRead('/v1/store/collections/' + slug)) as Collection
  if (data.slug !== slug || !Array.isArray(data.products))
    throw new Error('Invalid collection response.')
  return data
})
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
