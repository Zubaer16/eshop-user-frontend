import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  orderDate,
  orderDateTime,
  orderReference,
  readableReason,
  readableStatus,
  trackingEventTitle,
  uniqueTrackingEvents,
} from '../lib/order-presentation.ts'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('order references are compact while canonical IDs remain available to callers', () => {
  assert.equal(orderReference(id(10)), '#00000000')
  assert.equal(id(10), '00000000-0000-4000-8000-000000000010')
})

test('order dates are readable, UTC-stable and defensive for invalid values', () => {
  assert.equal(orderDate('2026-11-16T12:34:35.732Z'), 'Nov 16, 2026')
  assert.match(orderDateTime('2026-11-16T12:34:35.732Z'), /Nov 16, 2026/)
  assert.match(orderDateTime('2026-11-16T12:34:35.732Z'), /UTC/)
  assert.equal(orderDate('not-a-date'), 'Date unavailable')
  assert.equal(orderDateTime('not-a-date'), 'Date unavailable')
})

test('status and reason labels avoid raw enum formatting', () => {
  assert.equal(readableStatus('PENDING_PAYMENT'), 'Payment pending')
  assert.equal(readableStatus('RECEIVED_RESTOCKABLE'), 'Received · restockable')
  assert.equal(readableStatus('SOME_NEW_STATE'), 'Some New State')
  assert.equal(readableReason('NOT_AS_DESCRIBED'), 'Item not as described')
  assert.equal(readableReason('CUSTOMER_REQUEST'), 'Customer request')
})

test('tracking labels are customer-facing and unknown events remain understandable', () => {
  assert.equal(
    trackingEventTitle({
      id: id(1),
      type: 'ORDER',
      referenceId: id(2),
      status: 'PENDING_PAYMENT',
      occurredAt: '2026-11-16T12:00:00.000Z',
    }),
    'Order placed',
  )
  assert.equal(
    trackingEventTitle({
      id: id(3),
      type: 'SHIPMENT',
      referenceId: id(4),
      status: 'SHIPPED',
      occurredAt: '2026-11-16T13:00:00.000Z',
    }),
    'Order shipped',
  )
})

test('tracking de-duplicates semantic duplicates without dropping distinct history', () => {
  const first = {
      id: id(1),
      type: 'ORDER',
      referenceId: id(2),
      status: 'PENDING_PAYMENT',
      occurredAt: '2026-11-16T12:00:00.000Z',
    },
    duplicate = { ...first, id: id(3) },
    later = {
      ...first,
      id: id(4),
      status: 'PAID',
      occurredAt: '2026-11-16T12:10:00.000Z',
    },
    otherReference = { ...first, id: id(5), referenceId: id(4) }
  assert.deepEqual(
    uniqueTrackingEvents([first, duplicate, later, otherReference]).map(
      (event) => event.id,
    ),
    [id(1), id(4), id(5)],
  )
})
