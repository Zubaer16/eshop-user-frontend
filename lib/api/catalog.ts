export type Category = {
  id: string
  name: string
  slug: string
  description: string
  parentId: string | null
  color: string
  sortOrder: number
  active: boolean
}
export type GalleryImage = {
  id: string
  url: string
  src?: string
  alt: string
  position: number
  width: number
  height: number
  srcSet?: string
  sizes?: string
}
export type Variant = {
  id: string
  productId: string
  sku: string
  options: { size?: string; color?: string }
  priceMinor: number | null
  stockOnHand: number
  price?: { amountMinor: number; currency: string }
  available?: boolean
}
export type Product = {
  id: string
  title: string
  slug: string
  sku: string
  description: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  currency: string
  priceMinor: number
  compareAtMinor: number | null
  stockOnHand: number
  hasVariants: boolean
  variants: Variant[]
  categoryIds: string[]
  gallery: GalleryImage[]
  purchasable: boolean
  badge: string
  tag: 'new' | 'popular' | 'sale' | null
}
export type Page<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}
export type Balance = {
  id: string
  productId: string
  variantId: string | null
  sku: string
  title: string
  onHand: number
  reservedQuantity: number
  availableQuantity: number
  lowStockThreshold: number
  lowStock: boolean
}
export type Movement = {
  id: string
  requestId: string
  delta: number
  before: number
  after: number
  reason: string
  note: string
  createdAt: string
}
export type Asset = {
  id: string
  status: string
  url: string | null
  mimeType: string
  bytes: number
  width: number
  height: number
}
export const isUuid = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export function slugSegment(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200)
    throw new Error('Invalid product slug.')
  return slug
}
export function uuidSegment(id: string) {
  if (!isUuid(id)) throw new Error('Invalid record identity.')
  return id
}
export function minorFromInput(value: string, currency = 'USD'): number {
  const digits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  if (value.trim().length > 32)
    throw new Error('Amount exceeds the supported limit.')
  if (
    !new RegExp('^\\d+(?:\\.\\d{1,' + Math.max(digits, 1) + '})?$').test(
      value.trim(),
    ) ||
    (digits === 0 && value.includes('.'))
  )
    throw new Error('Enter a nonnegative amount using the currency precision.')
  const [whole, fraction = ''] = value.trim().split('.'),
    result =
      BigInt(whole) * BigInt(10) ** BigInt(digits) +
      BigInt(fraction.padEnd(digits, '0') || '0')
  if (result > BigInt(2147483647))
    throw new Error('Amount exceeds the supported limit.')
  return Number(result)
}
export function moneyInput(minor: number, currency = 'USD') {
  const digits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  return (minor / 10 ** digits).toFixed(digits)
}
export function money(minor: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    minor /
      10 **
        (new Intl.NumberFormat('en', {
          style: 'currency',
          currency,
        }).resolvedOptions().maximumFractionDigits ?? 2),
  )
}
export function categoryLabel(category: Category, categories: Category[]) {
  const parts = [category.name],
    seen = new Set([category.id])
  let parent = category.parentId
  while (parent && !seen.has(parent)) {
    seen.add(parent)
    const item = categories.find((c) => c.id === parent)
    if (!item) break
    parts.unshift(item.name)
    parent = item.parentId
  }
  return parts.join(' / ')
}
export function imageUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || '')
    return !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      ? url.href
      : null
  } catch {
    return null
  }
}
export type ShopQuery = {
  q?: string
  category?: string
  tag?: string
  sort?: string
  stock?: string
  min?: string
  max?: string
  page?: string
  price?: string
}
export function normalizeShopParams(input: ShopQuery): ShopQuery {
  const caps: Record<string, string> = { '0': '25', '1': '60', '2': '120' }
  return {
    ...input,
    sort: input.sort === 'featured' ? 'newest' : input.sort,
    stock: input.stock === '1' ? 'true' : input.stock,
    max: input.max ?? caps[input.price || ''],
  }
}
export function shopQuery(input: ShopQuery) {
  const page = Number(input.page || 1)
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new Error('Invalid page.')
  const query: Record<string, string | number | undefined> = {
    page,
    limit: 12,
    search: input.q?.trim().slice(0, 100) || undefined,
    category: input.category || undefined,
    currency: 'USD',
    sort: input.sort || 'newest',
  }
  if (!['newest', 'price-asc', 'price-desc'].includes(String(query.sort)))
    throw new Error('Invalid sort order.')
  if (query.category) slugSegment(String(query.category))
  if (input.tag) {
    if (!['new', 'popular', 'sale'].includes(input.tag))
      throw new Error('Invalid product tag.')
    query.tag = input.tag
  }
  if (input.stock) {
    if (!['true', 'false'].includes(input.stock))
      throw new Error('Invalid stock filter.')
    query.inStock = input.stock
  }
  if (input.min) query.minPriceMinor = minorFromInput(input.min)
  if (input.max) query.maxPriceMinor = minorFromInput(input.max)
  if (
    query.minPriceMinor !== undefined &&
    query.maxPriceMinor !== undefined &&
    Number(query.minPriceMinor) > Number(query.maxPriceMinor)
  )
    throw new Error('Minimum price cannot exceed maximum price.')
  return query
}
export function readProduct(value: unknown): Product {
  const p = value as Product
  if (
    !p ||
    !isUuid(p.id) ||
    typeof p.title !== 'string' ||
    !['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(p.status) ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !Number.isSafeInteger(p.priceMinor) ||
    p.priceMinor < 0 ||
    !Array.isArray(p.categoryIds) ||
    !p.categoryIds.every(isUuid) ||
    !Array.isArray(p.variants) ||
    !Array.isArray(p.gallery) ||
    typeof p.hasVariants !== 'boolean'
  )
    throw new Error('The catalog returned an invalid product.')
  return p
}
export function readPage<T>(
  value: unknown,
  item: (value: unknown) => T,
): Page<T> {
  const p = value as Page<unknown>
  if (
    !p ||
    !Array.isArray(p.items) ||
    ![p.total, p.page, p.limit, p.pages].every(Number.isSafeInteger) ||
    p.total < 0 ||
    p.page < 1 ||
    p.limit < 1 ||
    p.limit > 100 ||
    p.pages < 0
  )
    throw new Error('The service returned an invalid page.')
  return { ...p, items: p.items.map(item) }
}
export function readCategories(value: unknown): Category[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (c) =>
        c &&
        isUuid(c.id) &&
        typeof c.name === 'string' &&
        typeof c.slug === 'string' &&
        typeof c.active === 'boolean',
    )
  )
    throw new Error('The catalog returned invalid categories.')
  return value
}
