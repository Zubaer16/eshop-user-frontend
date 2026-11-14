# Storefront architecture

## Isolated account preload and navigation cache - 2026-11-14

The owner approved preloading the recommended customer data while preserving account isolation. Storefront now starts saved-address, profile and notification-preference GETs in the background after login or authenticated session restoration. Account/address pages and checkout consume shared reads. Ordinary checkout immediately renders its form and summary, with a local address-loading status when the cache is cold. Stripe return recovery and payment-button checks continue through the existing checkout flow.

A browser-memory Zustand store scopes private entries to the authenticated customer ID and session epoch. Session publication clears entries synchronously on logout, identity changes or a new session epoch. Queued requests verify the owner before dispatch and completed responses verify it again before publication. Mutation invalidation also fences older in-flight reads. Private data uses a bounded 40-entry allowlisted cache. Cache entries are memory-only. The selected freshness windows are five minutes for addresses/profile, one minute for notification preferences and fifteen seconds for order resources. Expired values can render while their current data is fetched. Explicit refresh bypasses freshness. Failed requests remain retryable.

Account menu and Orders navigation intent through hover, keyboard focus or touch warms the first order-history page. Individual order-link intent warms the owned order, tracking, returns, replacements and refund ledgers. Order actions and explicit refresh reload authoritative records. Cache use is confined to selected customer read endpoints. Authentication/session responses, checkout recovery and Stripe preparation continue through their existing transport paths.

Address/profile/preferences writes invalidate the relevant private entries even when a result is uncertain. Order/payment/checkout mutations invalidate cached order resources. Email-verification confirmation invalidates the profile. Late responses from an older account cannot populate the active cache or invalidate the replacement account through a stale page reload callback. Public bootstrap, operations and categories share the existing thirty-second public cache and request deduplication. Category focus refresh respects freshness, while explicit refresh forces a read.

Profile background refresh preserves an unsaved display-name edit. Cached notification preferences render immediately while their read completes, with editing gated until that preference read settles. A refreshed address country triggers a new delivery quote even when its address ID stays the same.

### Executed validation

- Storefront production build with type validation, lint and project verification passed. All 71 unit tests and 47 production-browser tests passed with zero retries or skips.
- Seven account-cache unit regressions cover shared reads and freshness, cloned values, logout/account-switch clearing, delayed/queued old-session responses, invalidation racing an old request, retry after failure, allowlisted endpoints, bounded storage and query isolation. Public-cache coverage now includes bootstrap, operations and categories while continuing to reject private resources.
- Nine browser regressions cover one address/profile preload across account/address/checkout navigation, the cold address-only loading state, successful address-edit invalidation, same-address country/pricing refresh after expiry, first-page order prefetch, owned order/ledger prefetch and forced refresh, a delayed account-A response during account-B restoration, preservation of an unsaved profile edit and notification-preference preload plus revisioned save.
- The warm-navigation browser test verifies one address GET and one profile GET across those page transitions and verifies that the address and profile name are absent from localStorage. Existing checkout recovery timing, stock correction, Stripe return, uncertain retry, concurrent cart edits and CSP tests passed. Git diff whitespace checks passed.

This batch changes User Frontend code. Source commit/push and live application deployment remain pending. Browser refresh starts a fresh in-memory account cache. Backend price/stock validation, reservation and payment authority continue at the approved checkout boundaries.

## Browser security headers and dependency remediation - 2026-11-14

The owner approved implementing the focused security-audit findings. Both frontend Next configurations now send Content-Security-Policy, X-Content-Type-Options nosniff, X-Frame-Options DENY and Referrer-Policy strict-origin-when-cross-origin. CSP blocks inline event-handler attributes, foreign scripts, object embeds, frames, base elements and cross-origin form submissions. Connections permit the configured browser API origin and the Firebase installation/FCM registration endpoints. Images retain HTTPS provider support. Same-origin workers support the existing push worker. Production enables upgrade-insecure-requests. Development allows eval and WebSocket connections for development tooling.

The CSP explicitly permits inline script blocks required by the current statically generated Next hydration and inline styles used by the UI/theme. This leaves residual inline-script injection exposure. It is a defense-in-depth policy with script-src-attr none. Existing JSX escaping, URL validation and server DTO checks remain relevant. Production builds retain static route generation and the current public-data caching behavior.

Both frontends use Next and eslint-config-next 15.5.29. Their gRPC transitive dependency is overridden to patched 1.13.6 while existing Firebase app/messaging imports remain in use. Backend Nest common/core/platform-express/testing are 11.2.10 and Swagger is 11.4.8. Prisma CLI, client and PostgreSQL adapter are aligned at 7.10.1. body-parser and fast-uri resolve patched releases within their dependency ranges. Production-only npm audits report zero advisories in each repository. Development dependency audits still report 6 moderate entries in each frontend and 8 low plus 9 moderate entries in Backend.

New production-browser tests in each frontend verify the response headers, production eval restriction and browser enforcement against an injected inline image event handler and a foreign script. Both probes remain unexecuted and the foreign script request is blocked before reaching the test route. Existing UI browser suites cover login, catalog/media presentation, owner settings, cart, stock correction and Stripe return flows. Firebase push unit tests cover registration ownership and worker privacy. Real external FCM delivery and live Stripe acceptance remain unverified for this batch.

### Executed validation

- Storefront production build, type checking, lint and verification passed with 63 unit tests and 38 production-browser tests.
- Admin production build, type checking, lint and verification passed with 48 unit tests and 26 production-browser tests.
- Backend Prisma generation/schema validation, type checking, Swagger syntax checks, lint and build passed. All 347 unit tests and 13 Jest HTTP tests passed. With the final fast-uri patch installed, the guarded local PostgreSQL database suite passed 84 tests, API security passed 67 tests and API smoke/contracts passed 62 tests.
- All three production-only dependency audits report zero advisories. Git diff whitespace checks passed. Database regression execution used the guarded localhost kookaburra_api_test configuration.

This implementation is local. Source commit/push and live application deployment remain pending.

## Checkout recovery moves to the payment action - 2026-11-14

The owner approved deferring checkout recovery until Continue to Stripe Checkout is clicked. Ordinary /checkout visits load saved addresses and delivery options without calling /v1/checkout/recovery. The initial status reads Loading checkout while addresses are loading. Returns and links containing an order query parameter recover automatically. On those visits, address loading and recovery run concurrently.

The payment action freezes the selected local items and delivery address, then checks recovery under the existing checkout/cart lock. An existing pending hosted order resumes through its owned session endpoint. A paid or terminal order shows its current state. A standalone active reservation retains the explicit release action before a fresh checkout. Recovery failures prevent a new start and leave a retryable error visible. Delivery refresh has a separate error state so it cannot clear payment-action failures. Duplicate clicks remain guarded and uncertain start retries retain the same request identity.

This batch changes Storefront presentation and request timing. Existing Backend endpoints handle recovery, current price/stock validation, atomic reservation and Stripe session replay. Tax remains disabled for new checkout and missing delivery charges remain zero under the prior approved decision.

Executed local validation passed production build with type checks, lint and project verification, all 63 unit tests and all 37 production-browser tests with zero retries or skips. Four new browser regressions cover deferred recovery and duplicate clicks, existing-order session reuse, retry after recovery failure and standalone-hold release. Existing stock correction, uncertain-request replay, Stripe success/cancel return, account changes and concurrent-cart preservation tests passed.

Source changes are local and await commit/push and deployment. External live payment acceptance remains pending.

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
