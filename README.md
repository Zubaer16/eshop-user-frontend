# eShop Storefront

One API-backed customer storefront using the approved design. Catalog, cart, saved items, account, checkout, orders and notifications use Backend data/actions. The temporary sample mode, mock commerce store and duplicate page tree are removed.

Requires Node.js 24 and npm. Configure the trusted Backend origin and exact app origin using `.env.example`. Local development normally uses Backend port 4000 and Storefront port 3000. Backend CORS must allow the actual app origin; production API origins require HTTPS.

```powershell
npm ci
npm run dev
```

The obsolete `NEXT_PUBLIC_ESHOP_MODE` setting is ignored and can be removed from deployment settings. It no longer controls rendering or authentication.

## Validation

```powershell
npm run verify
npm run verify:compatibility
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e -- --api-origin https://eshop-backend-mu.vercel.app
```

E2E builds a production bundle for the trusted HTTPS Backend and starts localhost:3211. Browser sessions/writes are intercepted; actual media/product checks use public GETs. No production account/cart/order/payment is written. `test:e2e:visual` runs the same suite headed; list/report commands remain available. See [E2E guide](docs/E2E_TESTING.md).

`app/` composes routes and auth boundaries; `components/store/` owns the homepage/shared cards/store provider; `components/catalog/` owns discovery/product details; `components/shopping/` owns account-fenced commerce. Auth, orders and notifications have feature components. `lib/api/` contains actual projections, transport, persistent session bridge and payload guards. Security/unit regressions live in `tests/`; the single browser suite lives in `e2e/`.

Backend UUIDs, price/stock, publication, ownership and order/payment/refund states remain authoritative. Domain API calls omit cookies and use Bearer JWT; refresh credentials stay in HttpOnly cookies. API errors show recovery UI and never substitute fictional content. Decorative illustrations are visual assets, not product data.

Store identity/logo/footer/policies/settings use public APIs with neutral defaults for empty optional content. Owner contact/legal content must be configured through Admin. Payments retain TEST-only scope. Provider, real-DB cross-app and deployment acceptance remain separate from controlled UI tests.

[Architecture](docs/ARCHITECTURE.md) · [Consolidation record](docs/STOREFRONT_CONSOLIDATION.md)
