> Cart presentation in this earlier phase is superseded by [optimistic atomic Add](OPTIMISTIC_CART_ADD_2026-11-13.md). Server rendering changes remain current.

# Store rendering and cart response — 2026-11-13

Owner authorized frontend/backend work needed to deliver public products in the initial HTML, reuse public content and open the cart immediately, while retaining current commerce authority.

## Public rendering

Home, Shop and collection pages now fetch existing public APIs on the server and pass initial content into the existing design. Public GETs use Next.js 30-second revalidation. Home is eligible for incremental static regeneration; Shop keeps its actual server-side search/filter/pagination query. Product detail stays request-rendered with its existing current-product refresh and 404 behavior.

Client pages seed the bounded public-memory cache from server snapshots using a supplied expiry. Expired snapshots do not extend browser freshness, and newer browser data or in-flight reads are not overwritten. The initial Shop render no longer needs a second browser product-list request. Manual Refresh still bypasses the client cache and requests current API content. Initial Shop images load eagerly; the main product image has high fetch priority. The route-level Shop skeleton was removed so completed server content is not held behind a JavaScript-dependent streaming fallback. Existing design and responsive layout are retained.

Next.js server revalidation is a public-content freshness policy, not a guaranteed payment/stock snapshot or exact deployment update deadline. Failed cold reads retain the existing retry path; public ISR may serve its last successful page while revalidating. Private/auth/cart/checkout/payment requests are never put in this public cache.

## Cart response

Previously Add awaited the current cart read and confirmed write before opening the drawer. Guest and account flows now open the drawer and show an updating status before either request completes. Homepage-card product verification runs inside the same busy/ownership-guarded operation, so it cannot delay opening the drawer either.

No new item, quantity, financial total or success notice is invented before the confirmed response. Existing confirmed lines may remain visible while updating; an initially empty cart does not falsely claim to be empty during an add. Retry controls appear only after a write remains uncertain, rather than while a normal write is still running. Closing the drawer is respected; a delayed success does not reopen it.

Existing canonical product/variant selection, fresh cart quantity read, cross-tab write/session locks, account-epoch guards, absolute-quantity retry payloads and Backend price/stock validation remain intact. No endpoint, DTO, business rule, database migration, dependency, real provider operation or production cart write was added. No Backend source edit was necessary.

## Validation

59 unit tests passed, including server-snapshot expiry and newer-browser-data preservation. Production build, typecheck, lint, structural guard and cross-repo source audits run locally. All 25 production-browser regressions passed with no retries/skips. Results: test-results/storefront/results.json. Guest/account drawer visibility is asserted within one second while cart responses remain held; this is a controlled local assertion, not a production latency claim. New checks exercise public HTML without JavaScript, absence of duplicate initial product reads, guest/account drawers before held cart requests finish, and homepage verification before any cart write. Existing design, filters, session, checkout and failed-write regressions remain covered. All browser mutations are intercepted; selected actual public catalog/media reads are read-only.

No commit, push or deployment is part of this local change. Production latency and provider acceptance must be distinguished from controlled browser checks.
