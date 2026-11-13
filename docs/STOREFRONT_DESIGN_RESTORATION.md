# Storefront live design restoration — 2026-11-13

**Superseded architecture:** the owner subsequently requested one Storefront, removing the temporary mode and duplicate tree. That consolidation is implemented in [STOREFRONT_CONSOLIDATION.md](STOREFRONT_CONSOLIDATION.md). Separate-mode/file/test references below are historical for the earlier restoration snapshot.

Implements the owner's request to repair the mismatches recorded in `LIVE_PREVIEW_DESIGN_AUDIT_2026-11-13.md`. Live screens retain the original storefront visual language while reading canonical APIs. Preview fixtures remain exclusive to explicit preview mode.

## Implementation

- Unconfigured operations preserve the storefront's blue palette and light baseline. Explicit configured branding still wins; primary, hover and focus ring tokens update together. Public profile/logo/footer data remain owner-managed. Empty optional public content has neutral presentation fallbacks; no legal policy, contact, logo or production settings were invented or written.
- Restores the navy four-column footer, benefit strip, real root category links and public account/policy/support navigation. Benefit copy avoids unverified free-shipping, payment and returns promises.
- One live card component serves homepage collections, collection detail, shop, related products and resolved wishlist items. It supports validated media, badge, category/tag, exact API currency/price/compare-at, wishlisting and variant-aware actions. Homepage quick-add resolves a full canonical product first and fences account changes; it never fabricates a product from a partial projection.
- Mobile shop restores a keyboard-accessible filter toggle, focus return and two-column product grid. Server pagination and supported filters remain authoritative. Category pages use icon feature tiles, root/child grouping and breadcrumbs; header/footer navigation uses roots, while subcategory links remain available on category pages and in shop filters.
- Hero restores blue/white styling around real published media, with responsive cropping, pastel promo cards and consistent category tiles. A single hero fills the row. Collection tabs show at most eight cards and link to full collections. Live copy no longer describes published collections as preview deals.
- Product detail restores breadcrumbs, prominent price/compare-at, image gallery, accessible variant buttons, numeric quantity with step controls, supporting panels and bounded real related products. Availability/mutation errors still block unsafe actions.
- Cart restores image rows and a desktop summary sidebar with checkout action. Optional public image metadata is lazy, bounded and matched by canonical identity; the cart quote remains the financial/stock authority. Wishlist uses the shared product card when its public detail resolves; removal remains available if optional public data cannot load.
- Live account reuses the responsive sidebar shell with actual account labels and actions. Checkout restores progress indication, framed controls and a desktop summary alongside the existing quote/hold/order/TEST-payment recovery workflow. Progress is derived from actual checkout state, not a separate optimistic state machine.

## Product-route 500

Reproduced on the local production server with `DYNAMIC_SERVER_USAGE`. The live product route's empty `generateStaticParams` put runtime slugs into fallback static generation despite no-store product reads. Request-time calls alone did not fix the production failure. The final route explicitly exports `dynamic = 'force-dynamic'` and removes static parameter generation. Production regression asserts actual product HTTP 200/content and missing-product HTTP 404. Preview products still render from their explicit preview source.

## Verification workflow

Final local results on Node 24.21.0: structural/international/compatibility checks, standalone typecheck/lint, production build, 55 unit tests, 14 live-design Chromium tests and all 18 existing preview browser journeys passed. Final browser runs had zero retries/skips/failures. Backend web-test TypeScript also passed. Full real-DB cross-app suites and deployment acceptance were not rerun. Actual owner public brand/contact/policy configuration remains pending; its empty-state presentation is repaired.

```powershell
npm run verify
npm run verify:compatibility
npm run typecheck
npm run lint
npm run test:unit
npm run test:design -- --api-origin https://eshop-backend-mu.vercel.app
npm run test:e2e
```

`test:design` builds a production live bundle using the supplied trusted public HTTPS Backend origin, without modifying `.env`. It starts a local production server on port 3211. Browser writes are intercepted. Controlled API-shaped data covers authenticated layout, product variants, exact mutation payloads, failed-write handling, palette, category hierarchy, mobile filters and bounded cards. Public server-side GETs verify product rendering. Real-media receipts use public GET responses bridged through the test request context because the production API does not allow the localhost test Origin; this is not a production CORS acceptance test. Native lazy loading is exercised by scrolling before screenshots. No database mutation, actual login, provider submission, payment, deployment, commit or push is part of this workflow.

The existing Backend integration catalog test now selects the visible variant button and asserts `aria-pressed`; business assertions remain intact. Backend runtime/Admin application source and API/schema contracts are unchanged. Detailed final command counts and current acceptance status are recorded in the owner's three Master Docs. Full real-DB cross-app/provider/deployment acceptance remains separate.

Generated receipts: ignored `test-results/design/results.json` and screenshots/traces under `test-results/design/artifacts/`; existing preview results use `test-results/results.json`. A local fix does not change the deployed Vercel site until the new source is deployed.
