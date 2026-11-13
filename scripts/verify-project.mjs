import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const read = (file) => readFileSync(file, 'utf8')
for (const file of [
  'app/page.tsx',
  'app/shop/page.tsx',
  'app/product/[slug]/page.tsx',
  'app/categories/page.tsx',
  'app/cart/page.tsx',
  'app/checkout/page.tsx',
  'app/account/page.tsx',
  'app/track/page.tsx',
  'components/store/home.tsx',
  'components/store/product-card.tsx',
  'components/store/category-tile.tsx',
  'components/store/store-content.tsx',
  'components/layout/footer.tsx',
])
  assert(existsSync(file), `Missing storefront source: ${file}`)
function inspect(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name)
    if (entry.isDirectory()) inspect(file)
    else if (/\.(tsx?|css)$/.test(file)) {
      const code = read(file)
      assert(
        !/[\u0985-\u09e1]/.test(code),
        `Unexpected non-English UI in ${file}`,
      )
      assert(
        !/isPreviewMode|NEXT_PUBLIC_ESHOP_MODE|lib\/catalog['"]|components\/preview|commerce-store|account-preview|checkout-preview/.test(
          code,
        ),
        `Retired fixture/mode dependency in ${file}`,
      )
    }
  }
}
for (const folder of ['app', 'components', 'hooks', 'lib']) inspect(folder)
for (const file of [
  'lib/integration-mode.ts',
  'lib/catalog.ts',
  'stores/commerce-store.ts',
  'components/store/live-homepage.tsx',
])
  assert(!existsSync(file), `Retired duplicate source still present: ${file}`)
assert(
  read('app/layout.tsx').includes('<html lang="en">'),
  'Page language must be English',
)
assert(
  read('app/product/[slug]/page.tsx').includes("dynamic = 'force-dynamic'"),
  'Product detail must remain request-rendered',
)
assert(
  read('components/auth/user-boundary.tsx').includes('<RequireAuth>'),
  'Private routes must retain the auth boundary',
)
assert(
  read('components/layout/providers.tsx').includes('<CommerceProvider>'),
  'Canonical cart/session provider required',
)
console.log(
  'Single API-backed storefront, English UI, request-time products and private route boundaries verified.',
)
