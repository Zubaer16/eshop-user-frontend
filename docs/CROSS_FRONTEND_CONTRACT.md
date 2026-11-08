# Admin ↔ Storefront Data Contract (Draft)

This document describes compatibility between the separate eShop Admin and Customer Storefront frontends. Both currently use **independent browser-local fixtures**. Neither application reads or controls the other's state. No backend, order creation, payment, inventory reservation or cross-app content publication has been enabled.

## Identity: preserve, then explicitly map

- Storefront fixture product IDs (such as `p-sneaker`) differ from Admin fixture IDs (such as `p-102`), even for similarly named items.
- Existing cart and wishlist IDs stay unchanged, including `kookaburra-storefront-preview-v1` storage. Never rewrite these with name-based guesses.
- Canonical product/category/variant IDs will be server-owned. Establish an **approved, explicit** mapping before importing fixture data. Some Admin and storefront prices and stocks differ: neither is authoritative.
- The current Storefront categories are flat (`parentId: null`); Admin permits nested categories. Seven storefront category slugs, including `lifestyle`, remain available.
- The storefront's color-only tote, size/color sneakers and simple products project into `ApiVariant.options` flexibly. A simple product is projected with an **empty variants array**, rather than a fabricated variant ID. Backend design must agree on how simple inventory lines work.

## Core projection modules

- `lib/api/contracts.ts`: mirrored `ApiCategory`, `ApiProduct`, `ApiVariant`, `ApiCartItem`, `QuoteRequest`, `ApiAddress`, `ApiCheckoutQuote`, `ApiOrder` drafts, aligned with the Admin-side compatibility draft.
- `lib/api/storefront-adapters.ts`: read-only `categoryToApi`, `productToApi`, `cartToApiItems`; USD prices become integer minor units; no fixture IDs are migrated and no out-of-stock variants are made purchasable.
- `lib/api/checkout-alignment.ts`: maps checkout countries to ISO 3166-1 alpha-2 codes and builds a **local, non-submitted** request draft and SKU/option snapshots. `Other country` is intentionally unresolved and requires selecting a specific country before a real quote. Cart lines without a required variant remain invalid.
- `lib/api/order-alignment.ts`: preserves independent fictional account order item/title/option snapshots with explicitly unresolved product/variant IDs; never guesses identity from matching names or prices.
- `lib/api/content-alignment.ts`: proposed public banner and featured-collection data shapes. Admin's local banners/collections are **not published** to the customer site. External CTA URLs are disallowed; product IDs must be explicitly matched. Current homepage fixtures remain unchanged.
- `lib/api/client.ts`: dormant future transport; use only when authenticated backend endpoints are implemented and approved.

## Checkout and order boundaries

1. Customer chooses a product and (if needed) an **explicit size/color variant**. The local cart holds `{productId, variantId?, quantity}`.
2. The checkout UI validates local fixture availability for the preview only. `cartToApiItems` preserves product and variant IDs without guessing.
3. The draft checkout address uses ISO country codes and item lines include optional SKU/option snapshots. The quote _request_ sends **no client-authoritative prices**.
4. A future backend must re-check auth, category/product status, stock, delivery eligibility, promotions, tax, currency and provide an **expiring server quote**, including authoritative amounts. The local sample shipping fee of $18 or $35 is **not** a server quote.
5. Only a future authenticated server can create orders, snapshots, Stripe test Checkout Sessions, fulfillment activity and verified refunds. Customer-account example orders are independent fictional fixtures; some have different item prices and are **not** joined to the active product catalog.
6. Real order lines should include canonical `variantId`, SKU and option snapshots, monetary snapshots and a backend order ID. Legacy previews with unknown variants remain flagged as unresolved; never infer sizes/colors.

## Content boundary

The Admin stores banner, campaign, coupon and featured collection previews locally. The storefront currently renders its own homepage and merchandising fixtures. Future public APIs must supply published, validated content with safe same-site CTA paths, approved product IDs and revision/visibility metadata. Coupon redemption **must not** be calculated authoritatively in the browser.

## Verification

```powershell
npm run verify:compatibility
npm run check
npm run test:e2e:visual
```

The new source-level verifier executes the TypeScript mapping functions and checks fixture coverage, item options, price minor units, ISO mapping, unresolved variants and content filtering. Playwright includes selected-variant review and unresolved-country preview journeys. Real server, auth, multi-app integration and production billing require separate tests once implemented.

## Backend handoff checklist

- Confirm canonical catalog ownership, import identity mapping and unique SKU policy.
- Decide simple-product vs explicit default-variant representation and stock allocations.
- Agree category parent/slugs and product/editorial/public-content visibility shape.
- Define `/v1` catalog, authenticated cart, checkout quote, payment, order, reporting and publication endpoints via OpenAPI.
- Add server-side shipping-country eligibility/tax rates, delivery IDs `standard`/`express`, and pricing reconciliation.
- Implement secure authenticated Admin RBAC/audit and customer sessions before enabling writes or payments.
