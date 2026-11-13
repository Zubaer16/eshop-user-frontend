import type { Metadata } from 'next'
import { Shop } from '@/components/catalog/catalog'
import { normalizeShopParams } from '@/lib/api/catalog'
import { publicShop } from '@/lib/api/public-catalog'

export const metadata: Metadata = {
  title: 'Explore Products',
  description:
    'Browse the current eShop catalog by category, price and availability.',
  robots: { index: false, follow: false },
}

type Params = {
  q?: string
  category?: string
  tag?: string
  sort?: string
  price?: string
  stock?: string
  min?: string
  max?: string
  page?: string
}
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const normalized = normalizeShopParams(params)
  const initial = await publicShop(normalized).catch(() => null)
  return (
    <Shop
      key={JSON.stringify(normalized)}
      params={normalized}
      initial={initial}
      expiresAt={Date.now() + 30000}
    />
  )
}
