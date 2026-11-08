import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkoutSelection,
  shippingSnapshot,
  readTotals,
  readReservation,
  readOrder,
  paymentEligible,
} from '../lib/api/checkout.ts'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const totals = {
  currency: 'USD',
  subtotalMinor: 999,
  discountMinor: 99,
  shippingMinor: 50,
  taxMinor: 90,
}
test('selection normalizes one coupon and does not transmit browser totals or currency', () => {
  assert.deepEqual(checkoutSelection(' us ', 'express', ' save_10 '), {
    countryCode: 'US',
    deliveryKind: 'express',
    couponCode: 'SAVE_10',
  })
  assert.deepEqual(checkoutSelection('US', '', ''), { countryCode: 'US' })
  for (const args of [
    ['USA', '', ''],
    ['US', 'overnight', ''],
    ['US', '', 'ONE,TWO'],
  ])
    assert.throws(() => checkoutSelection(...args))
})
test('order address is a snapshot allowlist without address-book IDs or customer fields', () => {
  const address = {
    id: id(1),
    userId: id(2),
    label: 'Private label',
    isDefault: true,
    recipientName: 'Test',
    phone: '+12025550123',
    addressLine1: '1 Test Road',
    city: 'City',
    countryCode: 'US',
  }
  const snapshot = shippingSnapshot(address)
  assert.deepEqual(
    Object.keys(snapshot).sort(),
    [
      'recipientName',
      'phone',
      'addressLine1',
      'addressLine2',
      'city',
      'region',
      'postalCode',
      'countryCode',
    ].sort(),
  )
  assert.throws(() => shippingSnapshot({ ...address, id: 'demo' }))
})
test('server totals preserve exact integers and reject unsafe, negative or inconsistent amounts', () => {
  assert.equal(readTotals(totals, 1040), totals)
  for (const value of [
    { ...totals, subtotalMinor: 1.1 },
    { ...totals, discountMinor: 1000 },
    { ...totals, taxMinor: -1 },
    { ...totals, currency: 'usd' },
    { ...totals, shippingMinor: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => readTotals(value, 1040))
  assert.throws(() => readTotals(totals, 1041))
})
test('stock hold, order and payment stay distinct; only matching TEST attempts allow explicit simulation/reconciliation', () => {
  const reservation = {
    ...totals,
    id: id(3),
    requestId: id(4),
    status: 'ACTIVE',
    expiresAt: '2026-11-08T10:00:00Z',
    estimatedTotalMinor: 1040,
    payable: false,
  }
  assert.equal(readReservation(reservation), reservation)
  assert.throws(() => readReservation({ ...reservation, payable: true }))
  const order = {
    ...totals,
    id: id(5),
    reservationId: id(3),
    status: 'PENDING_PAYMENT',
    totalMinor: 1040,
    paymentDeadlineAt: '2026-11-08T10:10:00Z',
    lines: [],
  }
  assert.equal(readOrder(order), order)
  const payment = {
    orderId: order.id,
    provider: 'STRIPE_TEST',
    preparationStatus: 'READY',
    amountMinor: 1040,
    currency: 'USD',
  }
  const now = Date.parse('2026-11-08T10:00:00Z')
  assert.equal(paymentEligible(order, payment, now), true)
  for (const preparationStatus of ['CONFIRMING', 'CAPTURING'])
    assert.equal(
      paymentEligible(order, { ...payment, preparationStatus }, now),
      true,
    )
  for (const p of [
    null,
    { ...payment, preparationStatus: 'AWAITING_WEBHOOK' },
    { ...payment, amountMinor: 1041 },
    { ...payment, currency: 'EUR' },
    { ...payment, provider: 'STRIPE_LIVE' },
    { ...payment, orderId: id(9) },
  ])
    assert.equal(paymentEligible(order, p, now), false)
  assert.equal(
    paymentEligible({ ...order, status: 'PAID' }, payment, now),
    false,
  )
  assert.equal(
    paymentEligible(order, payment, Date.parse(order.paymentDeadlineAt)),
    false,
  )
})
