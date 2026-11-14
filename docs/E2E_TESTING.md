# Storefront browser regressions

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


Current hosted Stripe checkout and stock reservation behavior is documented in [the final checkout flow](CART_QUANTITY_AUTOSAVE_2026-11-13.md). Its draft-cart, final-reservation and explicit shortage-recovery sections describe the current implementation.


Current quantity/save policy: [cart autosave and checkout validation](CART_QUANTITY_AUTOSAVE_2026-11-13.md). This supersedes older manual quantity forms and Add-time stock-rejection notes below.


There is one API-backed suite: `e2e/storefront.spec.mjs`. Temporary sample-only journeys/helpers are retired; API/session/commerce/security unit tests remain under `tests/`.

```powershell
npm run test:unit
npm run test:e2e -- --api-origin https://eshop-backend-mu.vercel.app
npm run test:e2e:visual -- --api-origin https://eshop-backend-mu.vercel.app
npm run test:e2e:list
npm run test:e2e:report
```

Use Node 24. The runner requires a trusted bare HTTPS Backend origin, builds the app, and starts a local production server on 3211. Only its child-process environment changes. Do not run another dev/build against the same `.next` directory concurrently.

Coverage: phone/tablet/desktop design, palette/footer/cards, hierarchy, mobile filter keyboard/query behavior, authenticated account/cart/wishlist/checkout layouts, canonical variants/quantity/rejected writes, session-form payloads, private redirects, API error recovery and production product 200/404.

Browser authentication and mutations are intercepted with controlled responses. Actual product/media checks use public GETs. Real-media screenshots bridge responses through the test request context because production CORS does not allow the localhost Origin; production CORS remains unchanged and deployed-origin acceptance is separate. Native lazy image loading is exercised before screenshots.

Receipts: ignored `test-results/storefront/results.json`, screenshots/traces under `test-results/storefront/artifacts/`, HTML `playwright-report/`. Real DB cross-app tests remain a separate guarded Backend suite and must not target production.

Server-rendered Home/Shop/collections are verified with JavaScript disabled. Controlled design tests use the normal Refresh controls to load browser-intercepted fixtures after real server rendering. Additional checks hold product/cart responses to prove the drawer is visible before confirmation and that pending operations never show invented success. Shop filtering now resolves on the server; tests verify the resulting URL/UI rather than expecting a redundant browser catalog request.

Current cart regressions cover optimistic item/estimated-subtotal display, one atomic Add without pre-reading the cart/product, rapid batch coalescing, definite-rejection rollback, ambiguous-outcome pause/replay, disabled checkout during sync and account-change isolation. The older preflight-only expectations are superseded by [optimistic atomic Add](OPTIMISTIC_CART_ADD_2026-11-13.md).
