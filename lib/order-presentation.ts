import type { Tracking } from './api/orders'

export type TrackingEvent = Tracking['events'][number]

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Payment pending',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  NOT_STARTED: 'Not started',
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED_RESTOCKABLE: 'Received · restockable',
  RECEIVED_DAMAGED: 'Received · damaged',
  RESTOCKED: 'Restocked',
  AUTHORIZED: 'Authorized',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  REQUIRES_REVIEW: 'Requires review',
}

const trackingEventLabels: Record<string, string> = {
  'ORDER:PENDING_PAYMENT': 'Order placed',
  'ORDER:PAID': 'Payment confirmed',
  'ORDER:CANCELLED': 'Order cancelled',
  'ORDER:EXPIRED': 'Payment window expired',
  'SHIPMENT:PROCESSING': 'Shipment processing',
  'SHIPMENT:SHIPPED': 'Order shipped',
  'SHIPMENT:DELIVERED': 'Order delivered',
  'RETURN:REQUESTED': 'Return requested',
  'RETURN:APPROVED': 'Return approved',
  'RETURN:REJECTED': 'Return declined',
  'RETURN:CANCELLED': 'Return request withdrawn',
  'RETURN:RECEIVED_RESTOCKABLE': 'Return received · restockable',
  'RETURN:RECEIVED_DAMAGED': 'Return received · damaged',
  'RETURN:RESTOCKED': 'Returned items restocked',
  'REPLACEMENT:AUTHORIZED': 'Replacement authorized',
  'REPLACEMENT:SHIPPED': 'Replacement shipped',
  'REPLACEMENT:DELIVERED': 'Replacement delivered',
  'REPLACEMENT:CANCELLED': 'Replacement cancelled',
}

export function orderReference(id: string) {
  return '#' + id.slice(0, 8).toUpperCase()
}

export function readableStatus(status: string) {
  return (
    statusLabels[status] ||
    status
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  )
}

export function readableReason(reason: string) {
  const labels: Record<string, string> = {
    DAMAGED: 'Item arrived damaged',
    WRONG_ITEM: 'Wrong item received',
    NOT_AS_DESCRIBED: 'Item not as described',
    OTHER: 'Other reason',
    CUSTOMER_REQUEST: 'Customer request',
    DUPLICATE: 'Duplicate payment',
    FRAUDULENT: 'Fraudulent activity',
  }
  return labels[reason] || readableStatus(reason)
}

export function orderDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function orderDateTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date)
}

export function uniqueTrackingEvents(events: TrackingEvent[]) {
  const seen = new Set<string>()
  return events.filter((event) => {
    // Different event IDs can describe the same persisted state transition.
    // Keep distinct references and timestamps; suppress only exact semantic duplicates.
    const key = [
      event.type,
      event.referenceId,
      event.status,
      event.occurredAt,
    ].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function trackingEventTitle(event: TrackingEvent) {
  return (
    trackingEventLabels[event.type + ':' + event.status] ||
    `${readableStatus(event.type)} · ${readableStatus(event.status)}`
  )
}
