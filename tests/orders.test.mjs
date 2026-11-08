import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  returnPayload,
  shippingPayload,
  refundPayload,
  returnableQuantity,
  readOrderDetail,
  inspected,
} from '../lib/api/orders.ts'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
test('return actions contain only a stable request UUID, canonical line and bounded quantity/reason', () => {
  assert.deepEqual(returnPayload(id(1), id(2), 2, 'DAMAGED'), {
    requestId: id(1),
    orderLineId: id(2),
    quantity: 2,
    reason: 'DAMAGED',
  })
  for (const args of [
    [id(1), 'demo', 1, 'OTHER'],
    [id(1), id(2), 0, 'OTHER'],
    [id(1), id(2), 1.5, 'OTHER'],
    [id(1), id(2), 100001, 'OTHER'],
    [id(1), id(2), 1, 'REFUNDED'],
  ])
    assert.throws(() => returnPayload(...args))
})
test('carrier/tracking are bounded plain identifiers and do not accept executable links', () => {
  assert.deepEqual(shippingPayload(id(1), ' DHL ', ' TRACK_123 '), {
    requestId: id(1),
    carrier: 'DHL',
    trackingNumber: 'TRACK_123',
  })
  for (const args of [
    [id(1), '<DHL>', 'TRACK123'],
    [id(1), 'DHL', 'https://example.test'],
    [id(1), 'X', 'AB'],
    ['demo', 'DHL', 'TRACK123'],
  ])
    assert.throws(() => shippingPayload(...args))
})
test('refund requests preserve exact minor units and cannot assert settlement or stock return', () => {
  assert.deepEqual(refundPayload(id(1), '2147483647', 'OTHER'), {
    requestId: id(1),
    amountMinor: 2147483647,
    reason: 'OTHER',
  })
  for (const amount of [
    '0',
    '-1',
    '1.50',
    '1e3',
    'NaN',
    '2147483648',
    '9007199254740993',
  ])
    assert.throws(() => refundPayload(id(1), amount, 'OTHER'))
  assert.throws(() => refundPayload(id(1), '100', 'SUCCEEDED'))
})
test('withdrawn/rejected returns release only their allowance; inspected/restocked units remain claimed', () => {
  const line = { id: id(2), quantity: 5 },
    rows = [
      { orderLineId: id(2), quantity: 1, status: 'REQUESTED' },
      { orderLineId: id(2), quantity: 2, status: 'RESTOCKED' },
      { orderLineId: id(2), quantity: 1, status: 'CANCELLED' },
      { orderLineId: id(2), quantity: 1, status: 'REJECTED' },
      { orderLineId: id(3), quantity: 5, status: 'APPROVED' },
    ]
  assert.equal(returnableQuantity(line, rows), 2)
  for (const state of ['RECEIVED_DAMAGED', 'RECEIVED_RESTOCKABLE', 'RESTOCKED'])
    assert.equal(inspected(state), true)
  for (const state of ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'])
    assert.equal(inspected(state), false)
})
test('order validation keeps immutable server totals distinct from shipment/refund states', () => {
  const order = {
    id: id(1),
    status: 'PAID',
    currency: 'USD',
    subtotalMinor: 2000,
    discountMinor: 100,
    shippingMinor: 100,
    taxMinor: 190,
    totalMinor: 2190,
    lines: [{ id: id(2), quantity: 2 }],
  }
  assert.equal(readOrderDetail(order), order)
  for (const change of [
    { status: 'DELIVERED' },
    { totalMinor: 2191 },
    { taxMinor: -1 },
    { subtotalMinor: Number.MAX_SAFE_INTEGER + 1 },
    { lines: [{ id: 'demo', quantity: 2 }] },
  ])
    assert.throws(() => readOrderDetail({ ...order, ...change }))
})
