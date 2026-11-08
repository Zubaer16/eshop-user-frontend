import type { Product } from './catalog'
export type Profile = {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
  role: 'CUSTOMER'
  createdAt: string
}
export type Address = {
  id: string
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
export type AddressInput = Omit<Address, 'id' | 'createdAt' | 'updatedAt'>
export type CartLine = {
  id: string
  productId: string
  variantId: string | null
  title: string
  sku: string | null
  quantity: number
  availableQuantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  currency: string
  status:
    | 'AVAILABLE'
    | 'OUT_OF_STOCK'
    | 'UNPUBLISHED'
    | 'VARIANT_INVALID'
    | 'CURRENCY_MISMATCH'
}
export type CartQuote = {
  cartId: string | null
  items: CartLine[]
  currency: string | null
  subtotalMinor: number
  amountDueMinor: number | null
  checkoutReady: boolean
  issues: string[]
  quotedAt: string
}
export type CartSelection = {
  productId: string
  variantId: string | null
  quantity: number
}
export type Wishlist = {
  items: {
    productId: string
    slug: string
    title: string
    currency: string
    priceMinor: number
    addedAt: string
  }[]
  count: number
}
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function readCart(value: unknown): CartQuote {
  const q = value as CartQuote
  if (
    !q ||
    (q.cartId !== null && !uuid(q.cartId)) ||
    !Array.isArray(q.items) ||
    q.items.length > 50 ||
    !integer(q.subtotalMinor) ||
    (q.currency !== null && !/^[A-Z]{3}$/.test(q.currency)) ||
    (q.amountDueMinor !== null && !integer(q.amountDueMinor)) ||
    typeof q.checkoutReady !== 'boolean' ||
    !Array.isArray(q.issues) ||
    !q.issues.every((s) => typeof s === 'string') ||
    typeof q.quotedAt !== 'string'
  )
    throw new Error('The cart service returned an invalid quote.')
  if (
    !q.items.every(
      (line) =>
        Boolean(line) &&
        typeof line === 'object' &&
        uuid(line.id) &&
        uuid(line.productId) &&
        (line.variantId === null || uuid(line.variantId)) &&
        typeof line.title === 'string' &&
        integer(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= 99 &&
        integer(line.availableQuantity) &&
        integer(line.unitPriceMinor) &&
        integer(line.lineTotalMinor) &&
        /^[A-Z]{3}$/.test(line.currency) &&
        [
          'AVAILABLE',
          'OUT_OF_STOCK',
          'UNPUBLISHED',
          'VARIANT_INVALID',
          'CURRENCY_MISMATCH',
        ].includes(line.status),
    )
  )
    throw new Error('The cart service returned invalid items.')
  return q
}
export function readWishlist(value: unknown): Wishlist {
  const result = value as Wishlist
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.length > 100 ||
    result.count !== result.items.length ||
    !result.items.every(
      (item) =>
        Boolean(item) &&
        typeof item === 'object' &&
        uuid(item.productId) &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) &&
        typeof item.title === 'string' &&
        /^[A-Z]{3}$/.test(item.currency) &&
        integer(item.priceMinor),
    )
  )
    throw new Error('The wishlist service returned invalid saved items.')
  return result
}
export function validateSelection(value: CartSelection) {
  if (
    !uuid(value.productId) ||
    (value.variantId !== null && !uuid(value.variantId)) ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > 99
  )
    throw new Error(
      'Choose a canonical product, an explicit valid variant and 1–99 units.',
    )
  return {
    productId: value.productId,
    variantId: value.variantId,
    quantity: value.quantity,
  }
}
export function productSelection(
  product: Product,
  variantId: string,
  quantity: number,
): CartSelection {
  if (
    product.hasVariants &&
    !product.variants.some((variant) => variant.id === variantId)
  )
    throw new Error('Choose a size / color option first.')
  return validateSelection({
    productId: product.id,
    variantId: product.hasVariants ? variantId : null,
    quantity,
  })
}
export function nextQuantity(quote: CartQuote, selection: CartSelection) {
  const current = quote.items.find(
    (line) =>
      line.productId === selection.productId &&
      line.variantId === selection.variantId,
  )
  return validateSelection({
    ...selection,
    quantity: (current?.quantity || 0) + selection.quantity,
  })
}
export function addressPayload(value: AddressInput, creating: boolean) {
  const result = {
    label: value.label.trim(),
    recipientName: value.recipientName.trim(),
    phone: value.phone.trim(),
    addressLine1: value.addressLine1.trim(),
    addressLine2: value.addressLine2.trim(),
    city: value.city.trim(),
    region: value.region.trim(),
    postalCode: value.postalCode.trim(),
    countryCode: value.countryCode.trim().toUpperCase(),
    ...(value.isDefault
      ? { isDefault: true }
      : creating
        ? { isDefault: false }
        : {}),
  }
  if (
    !result.label ||
    !result.recipientName ||
    !/^[+][1-9][0-9]{6,14}$/.test(result.phone) ||
    result.addressLine1.length < 3 ||
    !result.city ||
    !/^[A-Z]{2}$/.test(result.countryCode)
  )
    throw new Error(
      'Enter the label, recipient, E.164 phone, street, city and ISO country code.',
    )
  return result
}
