# Storefront architecture

## Tax removal and optional delivery defaults - 2026-11-14

The owner requested removal of checkout tax and a delivery charge of zero when no amount is configured. New checkout estimates and reservations use taxMinor 0. Tax configuration fields and tax_bps columns are removed. Existing order and reservation tax snapshots retain their recorded amounts, including frozen payment retries.

Delivery pricing resolves an enabled country/currency override, then a per-currency default, then zero. A disabled country override falls through to the currency default. Missing country policy permits checkout. Delivery zones continue to define configured service prices and availability. An explicit standard selection works with the fallback price. Express requires a configured service.

OWNER-only GET and PUT /v1/admin/checkout/defaults manage currency, shippingMinor, an optional freeOverSubtotalMinor and expectedRevision. Revision checks protect concurrent changes and updates are audited. Admin Delivery settings contains currency defaults and optional country rates. A blank delivery amount saves as zero. Tax inputs are removed.

Storefront automatically applies a single delivery service and retains selection when several services are available. Checkout omits the Tax row. Order receipts show positive historical tax amounts. Browser-local Zustand cart behavior and final server price validation with atomic stock reservation remain in place.

Migrations 20261114153000_checkout_default_rates and 20261114160000_remove_checkout_tax_configuration are applied only to the guarded local test database. The second migration follows the owner's tax-removal clarification. Local audit verified 44 applied migrations with 44 matching checksums, zero unresolved failures and zero pending migrations. Both rate tables have no tax_bps columns. Historical order and reservation tax columns remain.

Source changes await commit/push and application deployment. Both new live migrations remain pending. Real external Stripe provider, webhook and worker acceptance remains pending.

### Executed local validation

- Backend build, Prisma validation, type checks and lint passed. Unit tests passed 347, Jest HTTP tests 13, API smoke/contract tests 62, isolated database tests 84 and security tests 67. The final focused Stripe gateway run passed all 9 tests and preserves the existing provider request shape.
- Admin build, type checks, lint and verification passed with 48 unit tests and 25 production-browser tests. Browser coverage includes creating a currency default and editing its delivery amount to blank, which saves zero.
- Storefront build, type checks, lint and verification passed with 57 unit tests and 33 production-browser tests. Tax-free checkout presentation is covered.
- Four real local backend/admin/storefront browser integration tests passed. They cover OWNER default configuration, country delivery pricing, coupon totals, account isolation and reservation recovery.
- OpenAPI has 154 paths and 195 operations. Alignment audit reports 7 MATCH, 15 ADAPTER and zero REVIEW, with 4 audit-tool tests passing.

## Live local-cart migration applied - 2026-11-14

The owner explicitly authorized deployment to the live database using Backend .env credentials. Prisma used DIRECT_URL for the Supabase postgres database at aws-0-ap-south-1.pooler.supabase.com on port 5432. Preflight verified 41 applied migrations with matching checksums, zero unresolved failures and exactly one pending migration, 20261114120000_local_cart_checkout.

Prisma migrate deploy applied that migration successfully. The post-migration status reports the schema is up to date. The read-only audit verified 42 applied migrations, 42 matching checksums, zero unresolved failures and zero pending source migrations. Independent schema queries confirmed that carts, cart_items, guest_carts and guest_cart_items are absent, orders/reservations have zero cart_id references, and checkout_reservations.request_hash is nullable VARCHAR(64).

Preflight found one customer cart and five guest carts. Their saved cart contents were removed by the authorized migration. Before and after migration, order, reservation and payment-attempt counts were zero, physical inventory total was 200 and reserved inventory total was zero.

The live database migration is complete. Updated frontend/backend application deployment remains pending and is required for the new schema. Source changes await commit/push. Credentials stayed private. External Stripe provider/webhook/worker acceptance remains pending.


## Browser-local cart and checkout-only validation - 2026-11-14

The owner approved browser-local cart storage and removal of unused cart APIs and tables. Storefront now uses a provider-scoped Zustand store with versioned localStorage entries for the guest and each signed-in customer. Add, manual quantity entry, plus/minus, removal and clear calculate displayed totals locally. These actions make zero cart API requests. Guest items merge explicitly into the signed-in browser cart. Web Locks serialize same-browser writes and storage events update other tabs. Storage failures retain edits in memory and display a persistence notice.

Checkout submits canonical line/product/variant IDs and quantities. POST /v1/checkout/delivery-options calculates delivery/coupon estimates from submitted catalog selections without inventory joins. POST /v1/checkout/start validates current server prices and stock, locks inventory balances in sorted order and creates the existing replay-safe Stripe TEST hosted session. Request fingerprints include the immutable item selections and checkout policy. Stock shortages report requested and available quantities with user-selected quantity reduction or removal. Verified payment clears the matching submitted local cart. Later cart edits remain available.

The customer authorization guard moved into auth because account, wishlist, orders, payments and checkout share it. The old customer/guest cart controllers, persistence services, capability bridge and transport-only tests are removed. Wishlist remains account API-backed.

Migration 20261114120000_local_cart_checkout was applied only to the guarded local kookaburra_api_test database. It removes Cart, CartItem, GuestCart and GuestCartItem tables and cart_id references from orders/reservations, adds a nullable reservation request hash and preserves existing order, payment and stock-allocation records. Applying it removes old database-saved cart contents. Browser-local carts are device-specific. Coordinated production deployment and the new live migration remain pending. Real Stripe provider/webhook/worker acceptance remains external to the local test receipts.

### Executed local validation

- Frontend production build, type validation, lint and project verification passed. All 57 unit tests and 33 production-browser tests passed with zero retries or skips. Browser coverage includes guest/account Add without cart requests, typed quantity and plus/minus, reload persistence, cross-tab updates, quota-error memory fallback, stock shortage correction/removal, frozen checkout retry, signed-in owner changes cart clearing after verified payment and a concurrent cart edit held behind a browser lock while the checkout snapshot remains frozen.
- Backend build, Prisma schema validation, type validation and lint passed. All 333 unit tests, 13 Jest HTTP tests, 62 API smoke/contract tests, 82 isolated database tests and 67 security tests passed.
- Four browser integration tests against the guarded local backend passed. They exercise actual login, guest-to-account local merge, account isolation, address/customer privacy, configured delivery/coupon totals and owned reservation recovery/release.
- Five Swagger Chromium tests passed across delivery estimation, reservation create/replay/release, order create/replay/cancel and administrative/customer coupon flows. Removed cart capability tests and their unused Swagger authorization helper are retired.
- The isolated local migration audit verified 42 applied migrations, 42 matching checksums, zero unresolved failures and zero pending source migrations. Read-only schema queries confirmed all four old cart tables are absent, both cart_id references are absent and the reservation request_hash column exists.
- Canonical OpenAPI/source audit passed with 193 operations, 187 success schemas and six existing missing success schemas. Four alignment-tool tests and three release-tooling tests passed. Alignment remains seven MATCH and fifteen ADAPTER findings with zero REVIEW_REQUIRED findings.
- The full database run initially exposed an obsolete media fixture file path. Its assertion now uses the persisted objectKey and the rerun passed all 82 tests. The isolated Jest HTTP setup explicitly disables providers and suppresses deployment database URLs. Browser account-switch tests wait for completed logout cookie revocation before starting the next full-page login.


Current shared commerce state uses the scoped Zustand store in `lib/stores/shopping-store.ts`. Header/product subscriptions use shallow selectors. The cart implementation document records the 2026-11-14 immediate-Add and delayed-initial-read regression receipts.


Current browser cart, submitted-item checkout, final reservation and explicit shortage recovery are documented in [the checkout flow](CART_QUANTITY_AUTOSAVE_2026-11-13.md).


Current quantity/save policy: [cart autosave and checkout validation](CART_QUANTITY_AUTOSAVE_2026-11-13.md). This supersedes older manual quantity forms and Add-time stock-rejection notes below.


The customer app has one rendering path. The design established before Backend development now displays canonical API content. The temporary mode switch, sample catalog/cart/orders and duplicate page tree are removed.

Routes compose actual features. `UserBoundary`/`RequireAuth` protect private navigation; `AuthProvider` restores the real session. `CommerceProvider` exposes the scoped Zustand browser cart and independent owned wishlist. Browser totals use displayed catalog prices. Backend checkout owns fresh prices, stock reservations and payment settlement.

`StoreProvider` supplies bootstrap/operations. `components/store/home.tsx` composes the approved hero, promos, discovery strip, categories, collection tabs and lower promotion. Shared product/category cards, the navy footer and account/auth frames supply one presentation system. There is no alternate `Live*` component choice.

`lib/api/` contains actual projections/transport. Optional public image enrichment is lazy, bounded and canonical-ID checked; checkout catalog repricing remains authoritative. Product detail explicitly uses request-time rendering so newly published slugs work after deployment and missing products return 404.

Mutations retain auth, ownership, exact minor-unit amounts, explicit variants, inventory eligibility, idempotency and checkout recovery. Only confirmed Backend state indicates payment/refund success. Provider secrets remain deployment-owned. The API also serves Admin and future Flutter clients.

Controlled API responses exist in tests only. See [E2E guide](E2E_TESTING.md), [consolidation](STOREFRONT_CONSOLIDATION.md) and Master Docs for validation/deployment boundaries.

Public navigation uses a bounded 30-second browser-memory cache with in-flight deduplication; explicit refresh bypasses it. Private/cart/checkout/order/auth data is excluded. Public bootstrap metadata uses 30-second server revalidation; product detail remains request-time and commerce authority is unchanged. See [loading correction](NAVIGATION_LOADING_2026-11-13.md).

Home/Shop/collection content now arrives in server HTML using existing public APIs with 30-second revalidation, then seeds the public browser cache without extending expired snapshots. Cart drawers open before verification/network completion and show progress; only confirmed API results change items/totals. See [rendering and cart response](STORE_RENDERING_AND_CART_RESPONSE_2026-11-13.md).

Cart Add now uses an owner-fenced optimistic display projection and a serialized/coalescing queue. New replay-safe atomic delta POST endpoints return canonical quotes; existing absolute PUT, checkout and financial authority remain unchanged. Pending estimates never authorize checkout. See [atomic cart architecture](OPTIMISTIC_CART_ADD_2026-11-13.md).
