import { test } from 'node:test'
import assert from 'node:assert/strict'
import { additionPreview } from '../lib/api/cart-preview.ts'
test('selected variant preview uses its displayed price and SKU', () => {
  const preview = additionPreview(
    {
      title: 'Shirt',
      currency: 'USD',
      priceMinor: 1000,
      sku: 'BASE',
      gallery: [],
      variants: [{ id: 'blue', sku: 'BLUE', priceMinor: 1200 }],
    },
    'blue',
  )
  assert.equal(preview.unitPriceMinor, 1200)
  assert.equal(preview.sku, 'BLUE')
})
