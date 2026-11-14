import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
// Node strips TypeScript but requires the runtime extension used by its dependency.
const source = fs
  .readFileSync(new URL('../lib/stores/local-cart.ts', import.meta.url), 'utf8')
  .replace(
    "'../api/shopping'",
    JSON.stringify(new URL('../lib/api/shopping.ts', import.meta.url).href),
  )
const {
  localQuote,
  addLocalItem,
  decodeLocalCart,
  checkoutItems,
  cartStorageKey,
} = await import(
  'data:text/javascript,' +
    encodeURIComponent(
      (await import('typescript')).default.transpile(source, {
        module: 99,
        target: 99,
      }),
    )
)
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const preview = {
  title: 'Item',
  sku: 'SKU',
  unitPriceMinor: 125,
  currency: 'USD',
  image: null,
}
const selection = { productId: id(1), variantId: null, quantity: 12 }
test('local additions calculate displayed totals and submit identity and quantity only', () => {
  const cart = addLocalItem(localQuote([]), selection, preview, id(2))
  assert.equal(cart.subtotalMinor, 1500)
  assert.equal(cart.stockChecked, false)
  assert.equal(cart.items[0].availableQuantity, null)
  assert.deepEqual(checkoutItems(cart), [{ id: id(2), ...selection }])
  assert.deepEqual(
    decodeLocalCart(JSON.stringify({ version: 1, cart })).items,
    cart.items,
  )
  assert.notEqual(cartStorageKey(), cartStorageKey(id(3)))
})
test('local quantities stay bounded and duplicate additions retain line identity', () => {
  const cart = addLocalItem(localQuote([]), selection, preview, id(2))
  const changed = addLocalItem(
    cart,
    { ...selection, quantity: 2 },
    preview,
    id(4),
  )
  assert.equal(changed.items.length, 1)
  assert.equal(changed.items[0].id, id(2))
  assert.equal(changed.items[0].quantity, 14)
  assert.equal(cart.items[0].quantity, 12)
  assert.throws(() =>
    addLocalItem(cart, { ...selection, quantity: 99 }, preview, id(4)),
  )
  assert.throws(() =>
    addLocalItem(
      cart,
      { ...selection, quantity: 1 },
      { ...preview, currency: 'EUR' },
      id(4),
    ),
  )
  assert.throws(() => decodeLocalCart('{broken'))
  assert.throws(() =>
    decodeLocalCart(
      JSON.stringify({
        version: 1,
        cart: { ...cart, items: [...cart.items, ...cart.items] },
      }),
    ),
  )
})

test('saved UUID case aliases cannot create duplicate selections', () => {
  const selection = {
    productId: 'abcdef00-0000-4000-8000-000000000001',
    variantId: null,
    quantity: 1,
  }
  const cart = addLocalItem(localQuote([]), selection, preview, id(2))
  assert.throws(() =>
    decodeLocalCart(
      JSON.stringify({
        version: 1,
        cart: {
          ...cart,
          items: [
            cart.items[0],
            {
              ...cart.items[0],
              id: id(3),
              productId: selection.productId.toUpperCase(),
            },
          ],
        },
      }),
    ),
  )
})
