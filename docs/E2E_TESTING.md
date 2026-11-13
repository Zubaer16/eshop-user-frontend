# Storefront browser regressions

There is one API-backed suite: `e2e/storefront.spec.mjs`. Temporary sample-only journeys/helpers are retired; API/session/commerce/security unit tests remain under `tests/`.

```powershell
npm run test:unit
npm run test:e2e -- --api-origin https://eshop-backend-mu.vercel.app
npm run test:e2e:visual -- --api-origin https://eshop-backend-mu.vercel.app
npm run test:e2e:list
npm run test:e2e:report
```

Use Node 24. The runner requires a trusted bare HTTPS Backend origin, builds the app, and starts a local production server on 3211. Only its child-process environment changes. Do not run another dev/build against the same `.next` directory concurrently.

Coverage: phone/tablet/desktop design, palette/footer/cards, hierarchy, mobile filter keyboard/query behavior, authenticated account/cart/wishlist/checkout layouts, canonical variants/quantity/rejected writes, session-form payloads, private redirects, API error recovery and production product 200/404.

Browser authentication and mutations are intercepted with controlled responses. Actual product/media checks use public GETs. Real-media screenshots bridge responses through the test request context because production CORS does not allow the localhost Origin; production CORS remains unchanged and deployed-origin acceptance is separate. Native lazy image loading is exercised before screenshots.

Receipts: ignored `test-results/storefront/results.json`, screenshots/traces under `test-results/storefront/artifacts/`, HTML `playwright-report/`. Real DB cross-app tests remain a separate guarded Backend suite and must not target production.
