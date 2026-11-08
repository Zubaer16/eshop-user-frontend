import type { Metadata } from 'next'
import { ShopClient } from '@/components/store/shop-client'
import { LiveShop } from '@/components/catalog/catalog'
import { isPreviewMode } from '@/lib/integration-mode'
import { normalizeShopParams } from '@/lib/api/catalog'

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
  if (!isPreviewMode) {
    const normalized = normalizeShopParams(params)
    return <LiveShop key={JSON.stringify(normalized)} params={normalized} />
  }
  return (
    <ShopClient
      key={`${params.q ?? ''}/${params.category ?? ''}/${params.tag ?? ''}/${params.sort ?? ''}/${params.price ?? ''}/${params.stock ?? ''}`}
      query={params.q ?? ''}
      category={params.category ?? ''}
      tag={params.tag ?? ''}
      sort={params.sort ?? 'featured'}
      price={params.price ?? 'all'}
      stock={params.stock ?? ''}
    />
  )
}
