# Storefront Architecture

## Scope

eShop is a **single-vendor, multi-category** store. Only the company lists products; there are no seller accounts, commissions or vendor settlements. The website is English-only and displays a single USD catalog with an international destination selector during checkout. A single set of web design tokens will inform the future native Flutter client.

## Frontend

- **Framework:** Next.js App Router, React, TypeScript, Tailwind CSS.
- **UI:** shadcn/ui-compatible components, Radix primitives, Lucide icons.
- **Browser state:** Zustand persists a local cart and wishlist. Persistent state is not an authenticated account.
- **Catalog:** `lib/catalog.ts` contains non-authoritative example products, stock and USD prices.
- **Localization:** The application is English-only. No language selector or Bengali translation state is required.
- **Network boundary:** `lib/api/client.ts` and `lib/api/contracts.ts` are future-facing interfaces. The app does not currently submit orders or credentials.

## Separate services planned later

An independent NestJS API, PostgreSQL database, admin interface and Flutter application. Backend service contracts will govern catalog data, authentication, variants, inventory, country eligibility, checkout quotes, shipping, tax, returns and order status. The web and Flutter apps will use a shared versioned REST/OpenAPI specification.

## Trust and security

Local cart prices, delivery fees and stock cannot be trusted for checkout. The backend must recalculate authoritative pricing, reserve/validate inventory, apply tax/shipping policies, enforce account authorization and verify signed payment events. Avoid sending private customer data to third parties without purpose and appropriate safeguards.

See `docs/PAYMENTS.md` for the selected Stripe test-mode integration plan and `docs/FRONTEND_RELEASE_GATE.md` for readiness checks.

## Admin / Customer contract boundary

Storefront fixture catalog and Admin fixtures remain separate. `lib/api/storefront-adapters.ts` maps the existing sample catalog into the shared draft DTO without mutating IDs, stock or USD prices. `lib/api/checkout-alignment.ts` builds only non-submitted quote requests and illustrative line snapshots; it never asserts payment totals. `lib/api/content-alignment.ts` establishes future homepage merchandising schemas, not live publication. See `docs/CROSS_FRONTEND_CONTRACT.md` for explicit mapping and server-owned settlement requirements.
