# Frontend Release Criteria

**Current workflow, 2026-11-13:** one API-backed UI uses the approved design. Sample-mode requirements in older sections below are retired. Required local checks are verify/compatibility, TypeScript, ESLint, unit tests, production build and the single storefront E2E suite described in [the E2E guide](E2E_TESTING.md). Real DB cross-app/provider/deployed-origin evidence remains separate; no local test result implies full release acceptance.

The storefront is an **English-only UI implementation** and not yet a transaction-capable production store. Complete the following before a public launch.

## Code quality

- [ ] `npm ci`, `npm run check` and `npm audit --omit=dev` pass on Node.js 24.
- [ ] No customer-facing Bengali language toggle, translation residue or development-artifact references remain.
- [ ] No secrets, local `.env` files or personal data are committed.
- [ ] All external destinations and redirect flows are validated.

## UX and accessibility

- [ ] Home, Shop, Categories, Product, Cart, Wishlist, Checkout and Account work at 320px, 375px, 390px, 428px, tablet and desktop sizes.
- [ ] Keyboard navigation, focus indicators, dialogs, galleries, filter controls and checkout steps are operable and labelled correctly.
- [ ] Loading, empty, error, unavailable variant and over-stock states are covered.
- [ ] All display prices, delivery fees and order totals use USD consistently.

## Operational launch blockers

- [ ] Authenticated, authorized customer accounts and orders are backed by secure services.
- [ ] Product prices, taxes, delivery fees and inventory are validated server-side.
- [ ] Stripe test-mode sessions, signed webhooks and idempotent order updates are tested end to end; Stripe merchant eligibility is verified.
- [ ] Legal terms, privacy/returns pages, merchant operations and support processes are ready.
- [ ] Final SEO/canonical URLs, metadata and crawl/index settings are configured. This preview intentionally uses `noindex`.
- [ ] Real-browser functional checks, device checks, performance and accessibility audits pass.

Do not enable live payments, production indexing or claims of order completion before the corresponding gates pass.
