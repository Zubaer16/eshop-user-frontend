# Storefront architecture

Current quantity/save policy: [cart autosave and checkout validation](CART_QUANTITY_AUTOSAVE_2026-11-13.md). This supersedes older manual quantity forms and Add-time stock-rejection notes below.


The customer app has one rendering path. The design established before Backend development now displays canonical API content. The temporary mode switch, sample catalog/cart/orders and duplicate page tree are removed.

Routes compose actual features. `UserBoundary`/`RequireAuth` protect private navigation; `AuthProvider` restores the real session. `CommerceProvider` manages API-derived customer/guest carts and wishlist with owner/epoch fencing, explicit merge, current quotes and uncertain-write recovery. It does not persist fictional products or own money/stock authority.

`StoreProvider` supplies bootstrap/operations. `components/store/home.tsx` composes the approved hero, promos, discovery strip, categories, collection tabs and lower promotion. Shared product/category cards, the navy footer and account/auth frames supply one presentation system. There is no alternate `Live*` component choice.

`lib/api/` contains actual projections/transport. Optional public image enrichment is lazy, bounded and canonical-ID checked; cart quotes remain authoritative. Product detail explicitly uses request-time rendering so newly published slugs work after deployment and missing products return 404.

Mutations retain auth, ownership, exact minor-unit amounts, explicit variants, inventory eligibility, idempotency and checkout recovery. Only confirmed Backend state indicates payment/refund success. Provider secrets remain deployment-owned. The API also serves Admin and future Flutter clients.

Controlled API responses exist in tests only. See [E2E guide](E2E_TESTING.md), [consolidation](STOREFRONT_CONSOLIDATION.md) and Master Docs for validation/deployment boundaries.

Public navigation uses a bounded 30-second browser-memory cache with in-flight deduplication; explicit refresh bypasses it. Private/cart/checkout/order/auth data is excluded. Public bootstrap metadata uses 30-second server revalidation; product detail remains request-time and commerce authority is unchanged. See [loading correction](NAVIGATION_LOADING_2026-11-13.md).

Home/Shop/collection content now arrives in server HTML using existing public APIs with 30-second revalidation, then seeds the public browser cache without extending expired snapshots. Cart drawers open before verification/network completion and show progress; only confirmed API results change items/totals. See [rendering and cart response](STORE_RENDERING_AND_CART_RESPONSE_2026-11-13.md).

Cart Add now uses an owner-fenced optimistic display projection and a serialized/coalescing queue. New replay-safe atomic delta POST endpoints return canonical quotes; existing absolute PUT, checkout and financial authority remain unchanged. Pending estimates never authorize checkout. See [atomic cart architecture](OPTIMISTIC_CART_ADD_2026-11-13.md).
