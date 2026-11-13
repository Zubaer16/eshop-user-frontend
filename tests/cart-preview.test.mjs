import { test } from 'node:test'
import assert from 'node:assert/strict'
import { additionPreview, estimateAdditions } from '../lib/api/cart-preview.ts'

test('optimistic preview uses selected variant display data without mutating the server quote', () => {
  const product = {
    title: 'Shirt',
    currency: 'USD',
    priceMinor: 1000,
    sku: 'BASE',
    gallery: [],
    variants: [{ id: 'blue', sku: 'BLUE', priceMinor: 1200 }],
  }
  const preview = additionPreview(product, 'blue')
  assert.equal(preview.unitPriceMinor, 1200)
  assert.equal(preview.sku, 'BLUE')
  const quote = {
    currency: 'USD',
    subtotalMinor: 500,
    items: [{ quantity: 1 }],
  }
  assert.deepEqual(
    estimateAdditions(quote, [{ preview, selection: { quantity: 2 } }]),
    { currency: 'USD', subtotalMinor: 2900 },
  )
  assert.equal(quote.subtotalMinor, 500)
  assert.equal(quote.items[0].quantity, 1)
})
test('optimistic amounts never combine currencies or display invalid arithmetic', () => {
  const operation = {
    preview: { currency: 'EUR', unitPriceMinor: 100 },
    selection: { quantity: 2 },
  }
  assert.equal(
    estimateAdditions({ currency: 'USD', subtotalMinor: 100 }, [operation])
      .subtotalMinor,
    null,
  )
  assert.equal(
    estimateAdditions(null, [
      { ...operation, preview: { ...operation.preview, unitPriceMinor: NaN } },
    ]).subtotalMinor,
    null,
  )
  assert.equal(
    estimateAdditions(null, [
      {
        ...operation,
        preview: {
          ...operation.preview,
          unitPriceMinor: Number.MAX_SAFE_INTEGER,
        },
      },
    ]).subtotalMinor,
    null,
  )
})
