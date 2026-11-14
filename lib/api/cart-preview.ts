import type { Product, GalleryImage } from './catalog'
import type { StoreProductCard } from '@/components/store/store-content'

export type AddPreview = {
  title: string
  sku: string | null
  currency: string
  unitPriceMinor: number
  image: GalleryImage | StoreProductCard['image']
}
export function additionPreview(
  product: Product | StoreProductCard,
  variantId = '',
): AddPreview {
  const variant =
    'variants' in product
      ? product.variants.find((row) => row.id === variantId)
      : undefined
  return {
    title: product.title,
    sku: variant?.sku ?? ('sku' in product ? product.sku : null),
    currency: product.currency,
    unitPriceMinor: variant?.priceMinor ?? product.priceMinor,
    image: 'gallery' in product ? (product.gallery[0] ?? null) : product.image,
  }
}
