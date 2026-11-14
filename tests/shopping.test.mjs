import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  readCart,
  readWishlist,
  productSelection,
  validateSelection,
  addressPayload,
} from '../lib/api/shopping.ts'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const line = (changes) => ({
  id: id(1),
  productId: id(2),
  variantId: null,
  title: 'Canonical item',
  sku: 'ACTUAL-SKU',
  quantity: 2,
  availableQuantity: 9,
  unitPriceMinor: 125,
  lineTotalMinor: 250,
  currency: 'USD',
  status: 'AVAILABLE',
  ...changes,
})
const quote = (changes) => ({
  cartId: id(3),
  items: [line()],
  currency: 'USD',
  subtotalMinor: 250,
  amountDueMinor: null,
  checkoutReady: true,
  issues: [],
  quotedAt: '2026-11-07T00:00:00Z',
  ...changes,
})
test('cart retains authoritative amounts and issues rather than inventing a payable total', () => {
  const result = readCart(
    quote({
      items: [
        line(),
        line({ id: id(4), status: 'OUT_OF_STOCK', lineTotalMinor: 999 }),
      ],
      subtotalMinor: 250,
      checkoutReady: false,
      issues: [id(4) + ':OUT_OF_STOCK'],
    }),
  )
  assert.equal(result.subtotalMinor, 250)
  assert.equal(result.amountDueMinor, null)
  assert.equal(result.items[1].lineTotalMinor, 999)
  assert.equal(result.checkoutReady, false)
  for (const value of [
    quote({ cartId: 'demo-cart' }),
    quote({ items: [line({ quantity: 100 })] }),
    quote({ subtotalMinor: Number.MAX_SAFE_INTEGER + 1 }),
    quote({ items: [line({ status: 'PAID' })] }),
  ])
    assert.throws(() => readCart(value))
})
test('product selection preserves canonical product/variant IDs and bounded quantities', () => {
  const product = { id: id(2), hasVariants: true, variants: [{ id: id(3) }] }
  assert.deepEqual(productSelection(product, id(3), 2), {
    productId: id(2),
    variantId: id(3),
    quantity: 2,
  })
  assert.throws(() => productSelection(product, '', 1))
  assert.throws(() =>
    validateSelection({ productId: id(2), variantId: null, quantity: 100 }),
  )
})

test('address payload allowlists private fields and does not unset an existing default implicitly', () => {
  const address = {
    label: ' Home ',
    recipientName: ' Alex ',
    phone: '+12025550123',
    addressLine1: ' 1 Test Street ',
    addressLine2: '',
    city: ' City ',
    region: '',
    postalCode: '',
    countryCode: 'us',
    isDefault: false,
    email: 'forbidden@example.test',
    userId: id(9),
    role: 'OWNER',
  }
  const edit = addressPayload(address, false)
  assert.equal(edit.countryCode, 'US')
  assert.equal(edit.addressLine1, '1 Test Street')
  assert.equal(edit.isDefault, undefined)
  for (const field of ['email', 'userId', 'role'])
    assert.equal(field in edit, false)
  assert.equal(addressPayload(address, true).isDefault, false)
  assert.equal(
    addressPayload({ ...address, isDefault: true }, false).isDefault,
    true,
  )
  assert.throws(() => addressPayload({ ...address, label: ' ' }, true))
  assert.throws(() => addressPayload({ ...address, phone: '12345' }, true))
})
test('saved items accept only canonical owned-product projections and bounded response counts', () => {
  const item = {
    productId: id(2),
    slug: 'real-product',
    title: 'Saved product',
    currency: 'USD',
    priceMinor: 0,
    addedAt: '2026-11-07T00:00:00Z',
  }
  assert.equal(readWishlist({ items: [item], count: 1 }).items[0].priceMinor, 0)
  assert.throws(() =>
    readWishlist({
      items: [{ ...item, productId: 'fixture-product' }],
      count: 1,
    }),
  )
  assert.throws(() => readWishlist({ items: [item], count: 2 }))
})
