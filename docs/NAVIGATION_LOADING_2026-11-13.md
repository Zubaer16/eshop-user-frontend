# Repeated navigation loading — 2026-11-13

## Cause and change

Home and Shop cleared public results on every mount and repeated their API reads when revisited. Root metadata also forced request-time rendering and an uncached public bootstrap read. The existing shared layout providers already survive normal client navigation; private data is not the target of this change.

Added a public-only, browser-memory cache with a 30-second freshness window and a maximum of 40 query-specific entries. Concurrent identical reads share one in-flight request. Returning to Home, Shop and collection pages initializes from a still-fresh result, while related products and expanded collections share reads. Filter/page query values stay in the cache key. Full browser reload clears this memory cache. Expired content is fetched again; there is no indefinite stale-data fallback.

Explicit Refresh bypasses fresh cached data. Rejected reads/refreshes are removed and remain retryable. Component unmount fences its own late updates without cancelling another consumer's shared request; the existing API transport still owns request timeouts. Public product/category/store-content routes are allowlisted; private/cart/checkout/order/auth/admin requests cannot enter this cache. Product detail retains its request-time server read and existing fresh client refresh. Checkout/stock/prices remain Backend-authoritative.

Public metadata/bootstrap now requests 30-second Next.js revalidation instead of forcing every page through a new uncached bootstrap request. Next can cache common anonymous HTML shells; authenticated data still loads through the existing protected client/session transport and is not included in that public cache. No endpoint, request DTO, auth rule, business rule or Backend source changed. No new dependency or Zustand state was required.

## Validation

58 unit tests passed, including concurrent-read deduplication, TTL expiration, distinct queries, forced refresh, failure eviction, private-route rejection and bounded memory. Typecheck, lint, structural guard and production build passed. All 20 production-browser tests passed (no retries/skips): navigation, refresh/recovery, responsive layout and existing commerce/session checks. Results: `test-results/storefront/results.json`. Source alignment and web integration audits passed unchanged.

The navigation regression test visits Home → Shop → Categories → Shop → Home and confirms exactly one product-list GET and one homepage GET in the freshness window. Initial visits, expired data and protected operations can still require loading. Tests mock all browser writes; selected real public GETs are read-only. This is local validation, not a deployed speed benchmark. No commit, push or Vercel deployment performed.
