# Admin ↔ Storefront Data Contract

This document records the current source-level contract between the separate eShop Admin and Customer Storefront applications. The Backend remains authoritative for catalog, media, publication, pricing, availability, cart, checkout and order state.

## Current live Storefront integration (2026-11-12)

### Public data sources

- `GET /v1/store/bootstrap` supplies the configured store profile, published footer/policy/SEO text and verified logo/favicon references.
- `GET /v1/store/operations` supplies public presentation settings such as locale, display currency, theme, accent and navigation visibility. It does not convert product/order amounts; the USD catalog policy remains unchanged.
- `GET /v1/categories` supplies canonical active categories and their parent/child relationships. The Live Homepage renders active top-level categories from this response rather than the old seven-category preview fixture.
- `GET /v1/store/homepage` supplies the bounded published homepage projection. The response includes `schemaVersion`, opaque `revision`, `bannersTruncated`, `collectionsTruncated`, ordered banners and featured collections. Banners carry `slot` (`hero`, `secondary`, `promo`), `position`, a safe same-site CTA and a verified media projection.
- Homepage collection cards are bounded to eight products per collection. When the selected collection reports `productsTruncated`, the Storefront may request `GET /v1/store/collections/:slug` to load the canonical full collection projection (up to the Backend's detail limit) rather than silently treating the homepage preview limit as the collection's total.
- `GET /v1/store/collections/:slug` supplies the canonical published collection detail and ACTIVE product cards.
- `/v1/products` and the existing product detail routes remain the canonical product/shop source. Product links preserve server-provided slugs and prices remain integer minor-unit amounts with their returned currency.

### Live Homepage presentation

The Live Homepage now restores the composition of `components/preview/pages/home.tsx` while replacing preview fixtures with Backend data:

1. One large hero banner, selected by `slot=hero` (position order is the fallback), using the uploaded image as a full-width visual with readable text overlay. If a published hero is text-only, the existing local hero illustration is a decorative fallback.
2. Up to two compact promotional cards for the remaining published banners, with text and image balanced in a pastel split-card layout. Further banners remain visible in an additional responsive card row.
3. A three-item discovery/trust strip using non-transactional presentation copy.
4. Active top-level categories from `/v1/categories`, with deterministic icon mapping and the Backend-provided category tint where valid.
5. Keyboard-accessible featured-collection tabs from the published homepage projection. Truncated selected collections are expanded through the collection-detail API.
6. The original dark promotional section and local bottle illustration as a decorative footer section.

The Live Homepage does not read preview product/category fixtures as a fallback. `NEXT_PUBLIC_ESHOP_MODE=preview` continues to render the original Preview Page and its local fixtures. Live mode continues to use the Backend's published projections only.

### Media and navigation boundaries

- Public media URLs are accepted only through `imageUrl()`; it permits HTTPS and local HTTP development URLs, rejects credentials and other schemes.
- CTA links are rechecked as safe same-site paths in the browser. External/protocol-relative links, traversal and encoded separator tricks are not rendered.
- Product and collection destinations use canonical server slugs, URL-encoded as path segments.
- Product availability is a display hint only. Cart, reservation, checkout and payment authority remain server-side.
- The Storefront does not publish content, mutate Inventory, change prices, or write Admin records.

## Preview compatibility

`NEXT_PUBLIC_ESHOP_MODE=preview` remains a separate, explicit local preview mode. It uses `components/preview/pages/home.tsx`, `lib/catalog.ts`, local SVG artwork and preview-only shopping state. Preview fixtures are not used to fill missing Live API data.

## Verification commands

Run from the Storefront repository root using the repository-pinned Node version (`.nvmrc`, Node 24):

```powershell
npm run verify
npm run verify:compatibility
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e:list
```

Visual/browser acceptance still requires a configured live API and a browser run against the deployed or local Storefront. A source-level verifier passing is not proof of live API, media-host, browser or deployment acceptance.

## Change boundaries

The homepage restoration is a Storefront presentation-only change. It does not require a Backend API change, database migration, content rewrite, media re-upload, or Admin change. Preserve the current API shapes and the Backend's bounded publication rules.
