# eShop Storefront

Product name: **eShop**; package name: `eshop-user-frontend`. Existing checkout folders and persisted technical identifiers remain compatible.

A responsive, single-vendor, multi-category e-commerce storefront built with Next.js, TypeScript, Tailwind CSS and customizable shadcn/ui-style components. The interface is **English-only** with USD pricing and a unified international shopping experience. The web design provides the reference for a future Flutter app.

## Requirements

- Node.js 24 LTS (`.nvmrc`; run `nvm use 24` with NVM for Windows)
- npm

## Quick start

```powershell
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Validation

```powershell
npm run verify
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Alternatively, `npm run check` runs structural verification, TypeScript, ESLint and the Next.js production build.

## Automated browser tests

Playwright can run the storefront user journeys automatically in a visible Chromium window. It waits **900 ms after each UI event** and generates HTML reports and failure evidence. One-time installation: `npm install` then `npx playwright install chromium`. Run `npm run test:e2e:visual` for headed tests, `npm run test:e2e` for headless tests, or `npm run test:e2e:report` for the report. See [E2E Testing Guide](docs/E2E_TESTING.md) for Windows commands and coverage.

**Note:** These tests verify frontend preview behavior; preview authentication, actual orders and Stripe transactions remain disabled; live authentication has a separate suite.

## Explicit preview features

- Responsive homepage, product discovery, category navigation, search, filters, sort, and product pages.
- Image galleries and configurable sample size/color variants.
- Browser-persisted wishlist and variant-aware shopping cart.
- Address, delivery and order-review interface with international destination selection.
- Customer account, sample orders and shipment-tracking interface designs.
- Accessible navigation, loading/empty/error states and mobile layouts.
- English-only copy; all displayed prices and sample delivery fees are denominated in USD.

## Preview limitations

The product catalog, prices, availability, delivery estimates, orders and tracking are illustrative. In explicit preview mode sign-in/sign-up submissions, order placement and payments are disabled. Live authentication is documented below. Nothing here constitutes an authenticated customer account, confirmed inventory, actual delivery quote or a successful transaction.

**Payment plan:** Stripe **test mode** is selected for future integration, not activated in this frontend. A secure backend must create Checkout Sessions, validate prices/stock and verify Stripe webhooks before any payment flow is enabled. See [Payment Integration](docs/PAYMENTS.md).

## Structure

```text
app/               Next.js App Router screens, loading UI and metadata
components/        Shared UI, storefront, checkout and account components
lib/               Catalog fixtures, preview logic, API contracts and helpers
stores/            Browser-only cart/wishlist state
public/            Product artwork and site icon
design/            Web/Flutter design token contract
docs/              Architecture, payment plan, QA and Flutter parity
scripts/           Project verification
```

## Admin and Storefront data compatibility

The Storefront includes read-only projections for the shared Admin/API draft: products, categories, variants, cart lines, country codes and future quote requests. The checkout review displays selected SKU/options but does not submit a quote or take payment. Run `npm run verify:compatibility` for the contract checks; see [Cross-Frontend Data Contract](docs/CROSS_FRONTEND_CONTRACT.md) for mapping decisions and backend handoff.

## Architecture & rollout

This repository contains the **customer web frontend only**. The planned independent commerce API, database, admin dashboard and Flutter client are separate deliverables. Browser cart totals are never payment authority; the future backend must own customer sessions, quotes, inventory, order creation, tax/shipping and payment state.

- [Architecture](docs/ARCHITECTURE.md)
- [Payment Integration](docs/PAYMENTS.md)
- [Flutter Design Parity](docs/FLUTTER_PARITY.md)
- [Frontend QA & Release Criteria](docs/FRONTEND_RELEASE_GATE.md)

## Environment

Copy `.env.example` to `.env.local` only when needed. No API or Stripe keys are required for the local UI preview. Never commit `.env.local` or secret payment credentials.

The storefront is not approved for production transactions until its independent backend, payment processing, authorization and operational checks have been implemented and tested.

## API integration status

Steps 1–2 are complete: live API transport, authentication, persistent sessions and route permissions. Domain APIs use Bearer JWT under `/v1`; a same-origin Next session endpoint handles login/refresh/logout cookies. Login survives reload, new tabs and browser restart until the session expires or is revoked. Refresh tokens use a persistent HttpOnly cookie; access tokens stay in memory. Catalog, shopping and checkout commerce source is connected; remaining business screens show an unavailable state in live mode; sample data is enabled only with `NEXT_PUBLIC_ESHOP_MODE=preview`. API errors never switch to fixtures.

Copy `.env.example` to `.env.local`, set the bare Backend origin and exact `ESHOP_APP_ORIGIN`, and start the Backend on port 4000. Use User port 3000 and Admin port 3001 (`npm run dev -- --port 3001`); configure Backend `CORS_ORIGINS` for the actual frontend origins. Production API origins require HTTPS. Restart Next after changing public environment values.

Run `npm run test:auth` for transport/session/bridge cases, `npm run check` for static/build validation and existing `test:e2e` commands for explicit-preview regressions. The Backend's guarded `npm run test:web:auth` runs the real cross-app auth suite against its isolated local test database. Full plan and auth rules are in sibling Backend `docs/WEB_INTEGRATION.md`, `docs/WEB_AUTH.md` and `contracts/web-integration.v1.json`. Real SMTP/provider and complete product acceptance remain separate.

## Catalog integration source status

Catalog/category/product/variant/media/inventory integration source is implemented; full runtime validation is pending. User shop/category/product pages use canonical public API data and real metadata. Admin category/product/variant editors, `/media` and inventory use Backend records with current-grant write controls. No fixture IDs are imported; explicit preview remains separate. Cart and other business features remain scheduled.

New test code is prepared but not executed under the owner's defer-until-final policy. Intermediate commands are `npm run typecheck`, `npm run lint` and `npm run build`; inspect combined scripts before execution. During final acceptance use `npm run test:unit` for all adapter/auth/upload/access cases, existing preview E2E and the Backend's guarded `test:web:integration` for real cross-app flows. See sibling Backend `docs/WEB_CATALOG.md` for source scope, API additions, retry rules and limitations. Earlier auth test PASS counts describe their historical tested snapshot.

## Account/cart integration source status

Account profile/addresses, the guest/customer cart and explicit login merge, owned wishlist and read-only Admin customer directory are implemented in source. Guest capability uses a separate HttpOnly same-origin cookie with the Backend's fixed 14-day expiry; it is never imported into preview stores or exposed in browser JSON. Cart mutations retain absolute quantities for explicit safe retries; checkout/shipping/tax/coupons and TEST payment source are now implemented; runtime validation remains deferred.

New test code is prepared but execution is deferred until all remaining implementation work finishes. Typecheck/lint/build are the intermediate checks. See sibling Backend `docs/WEB_SHOPPING.md` for ownership, CSRF, conflict reconciliation, directory privacy, final-window commands and source-validation limits. No new environment setting or application dependency is needed beyond the existing trusted API/exact app origins and Next runtime.

## Checkout source delivery (2026-11-08)

Customer checkout uses owned saved-address snapshots, configured country/currency delivery and coupon estimates, expiring stock holds, idempotent unpaid order creation and explicit TEST payment actions. Reload/lost responses recover through owned server discovery. Admin policies follow OWNER-only checkout rate/zone guards, marketing revision/limit rules and payment-report permissions. No live card details or browser PAID flags. Test code is prepared; suites run together at final integration validation. Typecheck, lint and builds are the intermediate checks. See Backend `docs/WEB_CHECKOUT.md`.
