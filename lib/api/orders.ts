export type Shipment = {
  id: string
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
  carrier: string | null
  trackingNumber: string | null
  startedAt: string
  shippedAt: string | null
  deliveredAt: string | null
}
export type OrderLine = {
  id: string
  title: string
  sku: string | null
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  discountMinor: number
  netLineTotalMinor: number
  optionsSnapshotJson: string
}
export type OrderSummary = {
  id: string
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED'
  currency: string
  totalMinor: number
  discountMinor: number
  paidAt: string | null
  createdAt: string
  fulfillment: Shipment | null
}
export type OrderDetail = OrderSummary & {
  countryCode: string
  subtotalMinor: number
  shippingMinor: number
  taxMinor: number
  couponCode: string | null
  deliveryKind: string | null
  paymentDeadlineAt: string
  shippingAddress: {
    recipientName: string
    phone: string
    addressLine1: string
    addressLine2: string | null
    city: string
    region: string | null
    postalCode: string | null
    countryCode: string
  }
  lines: OrderLine[]
}
export type ReturnRow = {
  id: string
  orderId: string
  orderLineId: string
  quantity: number
  reason: string
  status: string
  createdAt: string
  updatedAt: string
}
export type ReplacementRow = {
  id: string
  orderId: string
  returnId: string
  skuSnapshot: string | null
  quantity: number
  status: string
  carrier: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
}
export type RefundRow = {
  id: string
  orderId: string
  requestId: string
  currency: string
  amountMinor: number
  reason: string
  status: string
  providerRefundSubmitted: boolean
  stockReturned: false
}
export type Tracking = {
  orderId: string
  orderStatus: string
  originalShipment: Shipment | null
  returns: ReturnRow[]
  replacements: ReplacementRow[]
  events: {
    id: string
    type: string
    referenceId: string
    status: string
    occurredAt: string
  }[]
}
export type OrderPage = {
  items: OrderSummary[]
  total: number
  page: number
  limit: number
  pages: number
}
export const isOrderId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
export const returnReasons = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'OTHER',
] as const
export function returnPayload(
  requestId: string,
  orderLineId: string,
  quantity: number,
  reason: string,
) {
  if (
    !isOrderId(requestId) ||
    !isOrderId(orderLineId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100000 ||
    !returnReasons.some((item) => item === reason)
  )
    throw new Error(
      'Choose an order line, a whole quantity and a return reason.',
    )
  return { requestId, orderLineId, quantity, reason }
}
export function shippingPayload(
  requestId: string,
  carrier: string,
  trackingNumber: string,
) {
  const result = {
    requestId,
    carrier: carrier.trim(),
    trackingNumber: trackingNumber.trim(),
  }
  if (
    !isOrderId(requestId) ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._&-]{1,79}$/.test(result.carrier) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{2,119}$/.test(result.trackingNumber)
  )
    throw new Error(
      'Enter a carrier (2–80 characters) and tracking number (3–120 letters, digits, underscores or hyphens).',
    )
  return result
}
export function refundPayload(
  requestId: string,
  amount: string,
  reason: string,
) {
  if (
    !isOrderId(requestId) ||
    !/^[1-9][0-9]*$/.test(amount) ||
    !Number.isSafeInteger(Number(amount)) ||
    Number(amount) > 2147483647 ||
    !['CUSTOMER_REQUEST', 'DUPLICATE', 'FRAUDULENT', 'OTHER'].includes(reason)
  )
    throw new Error(
      'Enter a positive whole refund amount in minor units and a reason.',
    )
  return { requestId, amountMinor: Number(amount), reason }
}
export function returnableQuantity(line: OrderLine, rows: ReturnRow[]) {
  const claimed = rows
    .filter(
      (row) =>
        row.orderLineId === line.id &&
        !['REJECTED', 'CANCELLED'].includes(row.status),
    )
    .reduce((sum, row) => sum + row.quantity, 0)
  return Math.max(0, line.quantity - claimed)
}
export function inspected(status: string) {
  return ['RECEIVED_DAMAGED', 'RECEIVED_RESTOCKABLE', 'RESTOCKED'].includes(
    status,
  )
}
export function readOrderDetail(value: OrderDetail) {
  const amounts = value && [
    value.subtotalMinor,
    value.discountMinor,
    value.shippingMinor,
    value.taxMinor,
    value.totalMinor,
  ]
  if (
    !value ||
    !isOrderId(value.id) ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    !['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED'].includes(
      value.status,
    ) ||
    !amounts.every((n) => Number.isSafeInteger(n) && n >= 0) ||
    value.subtotalMinor -
      value.discountMinor +
      value.shippingMinor +
      value.taxMinor !==
      value.totalMinor ||
    !Array.isArray(value.lines) ||
    !value.lines.every(
      (line) =>
        line &&
        isOrderId(line.id) &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0,
    )
  )
    throw new Error(
      'The server returned an invalid order. Refresh before continuing.',
    )
  return value
}
