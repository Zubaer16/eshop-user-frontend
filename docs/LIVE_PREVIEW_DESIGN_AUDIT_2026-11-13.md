# Live / preview storefront design audit — 2026-11-13

Follow-up: the owner requested repairs after this audit. See [Storefront design restoration](STOREFRONT_DESIGN_RESTORATION.md) and the Master Docs for implementation and validation. The audit observations below describe the pre-repair baseline.

Scope: audit only. Compared current local preview/live source, deployed HTML/JavaScript, and read-only public Backend responses. No application, database, provider, deployment or environment changes. Existing user change to `.env.example` preserved.

Storefront: https://eshop-user-frontend.vercel.app/
API: https://eshop-backend-mu.vercel.app/

## Evidence and limits

- Homepage, `/shop`, `/categories`, `/cart` returned HTTP 200. SSR text confirms simplified live shop/category/cart/footer paths. Client data loading was not treated as a failed API request.
- Deployed homepage chunk `/_next/static/chunks/4230-8a4aebab7a8cff00.js` contains `Refresh featured content`, `live-collection-panel`, `One place to explore` and the white live footer classes. The homepage restoration code is present in the served bundle; this does not establish pixel parity or exact whole-repository deployment identity.
- Public homepage, bootstrap, operations, categories, products and new-arrivals detail API GETs succeeded. Three published banners, four collections, 40 categories (eight roots, 32 children) were returned.
- Browser/desktop host unavailable: no screenshots, hydrated browser interaction, desktop/mobile viewport measurements, image crop inspection or authenticated acceptance. Findings below distinguish source-confirmed behavior from visual risks. No automated application suite ran for this documentation-only audit.

## Findings

| ID | Priority | Finding / evidence | Suggested correction (not implemented) |
|---|---|---|---|
| F01 | P1 | Brand color changes after live settings load. `app/globals.css:33` defines blue `#2459e8`; `components/store/live-store.tsx:116` applies API accent without checking `configured`. Public operations returned `configured:false`, `accentColor:#1F2937`; Backend `src/store-operations/store-operations.service.ts:37` supplies that fallback. Hover remains the separate blue `--primary-hover`. | Define how unconfigured branding preserves the approved storefront palette; retain explicitly configured owner colors and synchronize hover tokens. |
| F02 | P1 | Footer composition replaced. `components/layout/footer.tsx:22` selects a separate live footer. Preview has benefits strip, navy four-column layout, logo/category/quick links and bottom bar; `components/store/live-store.tsx:325` uses a small white text/navigation footer. Deployed HTML/bundle corroborate the live path. | Bind real profile/content/policy/category data into the approved footer composition. Avoid unverified shipping/payment promises. |
| F03 | P1 | Three separate product-card presentations: preview `components/store/product-card.tsx`, homepage `LiveProductCard` at `components/store/live-homepage.tsx:403`, and shop `Card` at `components/catalog/catalog.tsx:122`. Live homepage omits wishlist/category label and simple-product quick-add; live shop uses different image ratio, spacing, badge placement and stacked View/Add/Save controls. | Share a presentation contract while keeping real product selection, wishlist auth, availability and mutation guards authoritative. |
| F04 | P1 | Shop mobile layout differs structurally. Preview `components/store/shop-client.tsx:206` collapses filters behind a toggle; `:388` uses two product columns at base width. Live `components/catalog/catalog.tsx:167` has an always-visible form above products until desktop, one base product column, two at `sm`, three at `xl`. | Restore responsive filter drawer/toggle, grid density and toolbar around server pagination/filter semantics. Featured currently maps to newest; do not imply unsupported backend ranking. |
| F05 | P1 | Product details are rebuilt rather than styled through the preview composition. Preview `components/store/product-details.tsx` has breadcrumb, styled options, quantity stepper, wishlist icon, benefit panels and related products. Live `components/catalog/catalog.tsx:417` uses Back link, native variant select and separate numeric quantity/action panel. | Reuse approved visual composition with canonical live variants and server stock/price; only show related products or benefit claims backed by valid data. |
| F06 | P1 | Cart / wishlist lose product imagery and rich layout. Live line at `components/shopping/cart.tsx:170` is text/SKU/quantity; live cart wrapper at `:453` is max-width 4xl. Preview has image rows, breadcrumb and desktop summary sidebar. Live wishlist at `:486` is text cards with two columns at `sm`; preview uses image product cards, base two columns and four at `lg`. | Restore image rows/cards and responsive summary; inspect API image fields before promising this is entirely frontend work. |
| F07 | P2 | Category page and navigation flatten hierarchy. Preview category page has a tinted hero, breadcrumb, icon feature tiles and up to four desktop columns. Live `components/catalog/catalog.tsx:71` has simple cards with empty colored squares and up to three columns. Header `components/layout/header.tsx:88` maps every live category; API now has 40 entries, whereas homepage filters eight roots. | Preserve roots/children explicitly; use coherent icon tiles and grouped navigation. Forty-item menu crowding is a source/data risk, not screenshot-verified overflow. |
| F08 | P2 | Homepage restoration is partial design parity. Same overall hero/two-promo/trust/category/tabs/lower-promo composition exists, but image-present hero switches blue/white design to white/ink, has different heights/type, and side cards switch preview overlay artwork to split cropped photos. API returns three 1920x720 images; cover/fixed object positions need viewport QA. | Preserve the approved hero/card visual treatment using the real media; confirm image suitability and crops in browser. A single-banner dataset also leaves a desktop second grid track without a promo. |
| F09 | P2 | Homepage category density changes from preview base 3 / desktop 7 columns to live base 2 / xl 8, with descriptions added. API root taxonomy also differs: Footwear is now under Fashion, while Grocery/Books/Toys are new roots. | Preserve visual rhythm for the current taxonomy rather than copying fixture IDs or forcing seven real categories. |
| F10 | P2 | Collection behavior changes page length. Preview renders up to eight cards; live `components/store/live-homepage.tsx:576` renders all expanded detail products. New Arrivals currently projects eight of ten, then detail returns ten; selection can increase the section height. Preview tab names differ from actual published collection names. | Agree a card cap and View collection behavior. Keep real published collection titles; missing preview fixture tab names are not an API defect. |
| F11 | P2 | Account layout discards preview sidebar shell. `app/account/layout.tsx` passes `AccountShell` only to the preview branch; `components/auth/account-layout.tsx` returns children in live mode. Live account uses horizontal text `AccountNav`. Checkout likewise replaces preview three-step/two-column composition with a max-width 4xl vertical workflow (`components/shopping/checkout.tsx:210`). | Restore presentation while retaining login, owned orders, idempotency/recovery, quote/reservation and TEST payment boundaries. Authenticated UI was source-audited only. |
| F12 | P2 | Public store content is unconfigured: bootstrap returned profile/content/branding `configured:false`, storeName/supportEmail null, blank footer/policies, logo/favicon null. This is a real configuration gap in addition to layout changes. | Configure owner-approved public store data through Admin separately from presentation repair; do not populate production data during this audit. |

## Separate runtime blocker

R01 (P1): direct HTTP GET to `/product/non-slip-yoga-mat` returned 500 twice; `/product/hydrating-face-moisturizer` also returned 500. The corresponding yoga-mat Backend detail GET returned 200. Product paths came from the public product list. Cause is unconfirmed: inspect Vercel storefront function logs and server-side product rendering/environment. No claim that API failure or a particular component is the cause. Fix/verify this before accepting product-page design parity.

## Implementation order proposed for review

1. Diagnose product-route 500 and decide unconfigured branding fallback.
2. Footer plus one shared live product-card visual system.
3. Shop mobile filters/grid and category hierarchy/presentation.
4. Product detail, cart/wishlist, account and checkout presentation.
5. Homepage typography, hero media/crops, categories and collection card cap.
6. Real browser comparison at mobile/tablet/desktop widths with loading, empty, error and authenticated states. Existing functional PASS records do not prove preview/live design parity.

No implementation is authorized or claimed by this audit report. API-backed ownership, money, inventory, permissions and recovery rules remain constraints for any later repair. Do not enable preview fixtures on production to reproduce the design.
