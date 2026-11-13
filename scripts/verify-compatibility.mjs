import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (name) => readFileSync(name, 'utf8')
const catalog = read('lib/api/catalog.ts'),
  shopping = read('lib/api/shopping.ts'),
  checkout = read('lib/api/checkout.ts')
assert(
  catalog.includes('isUuid') &&
    catalog.includes('readProduct') &&
    catalog.includes('readPage'),
  'Canonical catalog guards required',
)
assert(
  catalog.includes("currency: 'USD'"),
  'Catalog price filters retain USD authority',
)
assert(
  shopping.includes('validateSelection') &&
    shopping.includes('productSelection'),
  'Canonical product/variant payloads required',
)
assert(
  checkout.includes('shippingSnapshot') &&
    checkout.includes('checkoutSelection') &&
    checkout.includes('readTotals'),
  'Checkout must retain server totals and bounded address/selection payloads',
)
assert(
  read('lib/api/runtime.ts').includes("credentials: 'omit'"),
  'Domain APIs must omit cookies',
)
assert(
  read('lib/api/session-server.ts').includes('HttpOnly'),
  'Persistent sessions must remain HttpOnly',
)
console.log(
  'Canonical catalog, cart, checkout and session boundary source guards passed; runtime contracts are covered by unit/E2E tests.',
)
