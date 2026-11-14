import type { Address } from './shopping'
export type DeliveryKind = 'standard' | 'express'
export type Selection = {
  countryCode: string
  deliveryKind?: DeliveryKind
  couponCode?: string
}
export type Totals = {
  currency: string
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
}
export type Estimate = Totals &
  Selection & {
    estimatedTotalMinor: number
    quotedAt: string
    deliveryEtaNote: string
    payable: false
  }
export type Reservation = Totals & {
  id: string
  requestId: string
  countryCode: string
  deliveryKind: DeliveryKind | null
  couponCode: string | null
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'CONSUMED'
  expiresAt: string
  estimatedTotalMinor: number
  payable: false
}
export type ShippingAddress = Pick<
  Address,
  | 'recipientName'
  | 'phone'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'region'
  | 'postalCode'
  | 'countryCode'
>
export type Order = Totals & {
  id: string
  reservationId: string
  requestId: string
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  totalMinor: number
  shippingAddress: ShippingAddress
  paymentDeadlineAt: string
  paidAt: string | null
  lines: {
    id: string
    title: string
    sku: string | null
    quantity: number
    netLineTotalMinor: number
  }[]
}
export type Payment = {
  orderId: string
  checkoutStarted?: boolean
  checkoutSessionId?: string | null
  provider: 'STRIPE_TEST'
  preparationStatus: string
  amountMinor: number
  currency: string
  canConfirm: false
  payable: false
}
export type Recovery = {
  reservation: Reservation | null
  orderId: string | null
}
export type DeliveryOptions = Totals & {
  countryCode: string
  guestCheckoutEnabled: false
  options: {
    kind: DeliveryKind | null
    label: string
    shippingMinor: number
    taxMinor: number
    totalMinor: number
    etaNote: string
  }[]
}
export const canonicalId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
export function checkoutSelection(
  country: string,
  kind: string,
  coupon: string,
): Selection {
  const countryCode = country.trim().toUpperCase(),
    couponCode = coupon.trim().toUpperCase()
  if (
    !/^[A-Z]{2}$/.test(countryCode) ||
    !['', 'standard', 'express'].includes(kind) ||
    (couponCode && !/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(couponCode))
  )
    throw new Error(
      'Select a destination, an available delivery option and one valid coupon code.',
    )
  return {
    countryCode,
    ...(kind ? { deliveryKind: kind as DeliveryKind } : {}),
    ...(couponCode ? { couponCode } : {}),
  }
}
export function shippingSnapshot(address: Address): ShippingAddress {
  if (!canonicalId(address.id)) throw new Error('Choose your saved address.')
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    region: address.region || '',
    postalCode: address.postalCode || '',
    countryCode: address.countryCode,
  }
}
export function readTotals<T extends Totals>(value: T, total: number): T {
  if (
    !value ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    ![
      value.subtotalMinor,
      value.discountMinor,
      value.shippingMinor,
      value.taxMinor,
      total,
    ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    value.discountMinor > value.subtotalMinor ||
    value.subtotalMinor -
      value.discountMinor +
      value.shippingMinor +
      value.taxMinor !==
      total
  )
    throw new Error(
      'Checkout returned invalid totals. Refresh before continuing.',
    )
  return value
}
export function readReservation(value: Reservation) {
  readTotals(value, value?.estimatedTotalMinor)
  if (
    !canonicalId(value.id) ||
    !canonicalId(value.requestId) ||
    !['ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED'].includes(value.status) ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    value.payable !== false
  )
    throw new Error('Invalid reservation response.')
  return value
}
export function readOrder(value: Order) {
  readTotals(value, value?.totalMinor)
  if (
    !canonicalId(value.id) ||
    !canonicalId(value.reservationId) ||
    !['PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED'].includes(
      value.status,
    ) ||
    !Array.isArray(value.lines)
  )
    throw new Error('Invalid order response.')
  return value
}
export function paymentEligible(
  order: Order,
  payment: Payment | null,
  now = Date.now(),
) {
  return (
    order.status === 'PENDING_PAYMENT' &&
    Date.parse(order.paymentDeadlineAt) > now &&
    payment?.provider === 'STRIPE_TEST' &&
    payment.orderId === order.id &&
    payment.currency === order.currency &&
    payment.amountMinor === order.totalMinor &&
    ['READY', 'CONFIRMING', 'CAPTURING'].includes(payment.preparationStatus)
  )
}

export type StockShortage = {
  itemId: string
  productId: string
  variantId: string | null
  title: string
  sku: string | null
  requestedQuantity: number
  availableQuantity: number
}
export function stockShortages(value: unknown): StockShortage[] {
  const body = value as { code?: unknown; items?: StockShortage[] } | null
  if (
    body?.code !== 'INSUFFICIENT_STOCK' ||
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 50
  )
    return []
  if (
    !body.items.every(
      (line) =>
        line &&
        canonicalId(line.itemId) &&
        canonicalId(line.productId) &&
        (line.variantId === null || canonicalId(line.variantId)) &&
        typeof line.title === 'string' &&
        line.title.length <= 240 &&
        Number.isInteger(line.requestedQuantity) &&
        line.requestedQuantity >= 1 &&
        line.requestedQuantity <= 99 &&
        Number.isSafeInteger(line.availableQuantity) &&
        line.availableQuantity >= 0 &&
        line.availableQuantity < line.requestedQuantity,
    )
  )
    return []
  return body.items
}
export function hostedCheckout(value: unknown) {
  const result = value as {
    orderId: string
    sessionId: string
    url: string
    expiresAt: string
  }
  const url = new URL(result.url)
  if (
    !canonicalId(result.orderId) ||
    !/^cs_test_[A-Za-z0-9]{6,120}$/.test(result.sessionId) ||
    url.protocol !== 'https:' ||
    url.origin !== 'https://checkout.stripe.com' ||
    url.username ||
    url.password ||
    !Number.isFinite(Date.parse(result.expiresAt)) ||
    Date.parse(result.expiresAt) <= Date.now()
  )
    throw new Error(
      'Invalid Stripe Checkout response. Refresh checkout status.',
    )
  return result
}
