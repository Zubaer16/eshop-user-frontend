# Frontend QA Checklist

**Current workflow, 2026-11-13:** exercise the single API-backed storefront; the temporary sample UI and its journeys/helpers have been removed. Use [the current E2E guide](E2E_TESTING.md) and [consolidation record](STOREFRONT_CONSOLIDATION.md). Older mock-only setup steps below are historical, not executable requirements. Keep auth/ownership, loading/error/empty handling, exact server totals, variant/quantity payloads and recovery checks.

## Setup

- Use Node.js 24, run `npm ci`, `npm run check`, and `npm audit --omit=dev`.
- Run `npm run dev` and open the storefront in current desktop and mobile browsers.

## Catalog and shopping

- Navigate categories including Fashion and Shoes & Footwear.
- Search and filter by product, category, price and stock; verify URL query preservation.
- Select each required size/color combination and validate unavailable variants.
- Add different variants to cart and confirm they remain distinct.
- Reload and verify local cart, wishlist and USD-only price display remain intact.

## Checkout and account previews

- Check invalid/empty cart restrictions, address fields, destination selection, delivery selection and order review.
- Confirm that no checkout/payment action submits an actual order or payment.
- Confirm sign-in and sign-up do not submit credentials.
- Review sample orders, tracking timeline, account settings and English labels.

## Accessibility and presentation

- Test keyboard tabbing and Escape interactions on menus/dialogs, accessible names and status messages.
- Test 320–428px phones, tablet/desktop layouts, focus rings, touch sizing and reduced motion.
- Confirm preview `noindex` remains until launch authorization.
