import type { Product, GalleryImage } from './catalog'
import type { StoreProductCard } from '@/components/store/store-content'
import type { CartQuote, CartSelection } from './shopping'

export type AddPreview = {
  title: string
  sku: string | null
  currency: string
  unitPriceMinor: number
  image: GalleryImage | StoreProductCard['image']
}
export type OptimisticAddition = {
  owner: string
  requestId: string
  selection: CartSelection
  preview: AddPreview
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
export function estimateAdditions(
  cart: CartQuote | null,
  additions: OptimisticAddition[],
) {
  const currency = cart?.currency || additions[0]?.preview.currency || null
  let subtotalMinor = cart?.subtotalMinor ?? 0
  for (const { selection, preview } of additions) {
    if (
      preview.currency !== currency ||
      !Number.isSafeInteger(preview.unitPriceMinor) ||
      preview.unitPriceMinor < 0
    )
      return { currency, subtotalMinor: null }
    subtotalMinor += preview.unitPriceMinor * selection.quantity
  }
  return {
    currency,
    subtotalMinor: Number.isSafeInteger(subtotalMinor) ? subtotalMinor : null,
  }
}
