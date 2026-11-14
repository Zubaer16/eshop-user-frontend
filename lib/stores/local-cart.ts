import {
  readCart,
  validateSelection,
  type CartLine,
  type CartQuote,
  type CartSelection,
} from '../api/shopping'
import type { AddPreview } from '../api/cart-preview.ts'

export const cartStorageKey = (userId?: string) =>
  'eshop-cart-v1:' + (userId || 'guest')
export function localQuote(items: CartLine[]): CartQuote {
  const currency = items[0]?.currency ?? null
  const mixed = items.some((item) => item.currency !== currency)
  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.lineTotalMinor,
    0,
  )
  if (!Number.isSafeInteger(subtotalMinor))
    throw new Error('Cart total exceeds the supported amount.')
  return {
    cartId: null,
    stockChecked: false,
    items,
    currency,
    subtotalMinor,
    amountDueMinor: null,
    checkoutReady: items.length > 0 && !mixed,
    issues: mixed ? ['CURRENCY_MISMATCH'] : [],
    quotedAt: new Date().toISOString(),
  }
}
export function decodeLocalCart(value: string | null): CartQuote {
  if (!value) return localQuote([])
  const data = JSON.parse(value)
  if (data.version !== 1)
    throw new Error('This saved cart version is unsupported.')
  const quote = readCart(data.cart)
  const identities = new Set<string>()
  const ids = new Set<string>()
  const items = quote.items.map((item) => {
    const selection = validateSelection(item)
    const identity = selection.productId + ':' + (selection.variantId || '')
    const id = item.id.toLowerCase()
    if (identities.has(identity) || ids.has(id))
      throw new Error('Saved cart contains duplicate lines.')
    identities.add(identity)
    ids.add(id)
    return {
      ...item,
      ...selection,
      id,
      availableQuantity: null,
      status: 'AVAILABLE' as const,
      lineTotalMinor: item.unitPriceMinor * item.quantity,
    }
  })
  return localQuote(items)
}
export function addLocalItem(
  cart: CartQuote,
  selection: CartSelection,
  preview: AddPreview,
  id: string,
): CartQuote {
  const desired = validateSelection(selection)
  if (
    !/^[A-Z]{3}$/.test(preview.currency) ||
    !Number.isSafeInteger(preview.unitPriceMinor) ||
    preview.unitPriceMinor < 0
  )
    throw new Error('This product has an invalid display price.')
  if (cart.currency && cart.currency !== preview.currency)
    throw new Error('Choose products in the same currency for this cart.')
  const existing = cart.items.find(
    (item) =>
      item.productId === desired.productId &&
      item.variantId === desired.variantId,
  )
  const quantity = desired.quantity + (existing?.quantity || 0)
  validateSelection({ ...desired, quantity })
  if (!existing && cart.items.length >= 50)
    throw new Error('A cart can contain up to 50 different items.')
  const line: CartLine = {
    ...desired,
    id: existing?.id ?? id,
    quantity,
    title: preview.title,
    sku: preview.sku,
    image: preview.image,
    currency: preview.currency,
    unitPriceMinor: preview.unitPriceMinor,
    lineTotalMinor: preview.unitPriceMinor * quantity,
    availableQuantity: null,
    status: 'AVAILABLE',
  }
  return localQuote(
    existing
      ? cart.items.map((item) => (item.id === existing.id ? line : item))
      : [...cart.items, line],
  )
}
export function checkoutItems(cart: CartQuote | null) {
  return (
    cart?.items.map(({ id, productId, variantId, quantity }) => ({
      id,
      productId,
      variantId,
      quantity,
    })) ?? []
  )
}
