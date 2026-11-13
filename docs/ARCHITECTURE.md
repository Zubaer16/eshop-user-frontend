# Storefront architecture

The customer app has one rendering path. The design established before Backend development now displays canonical API content. The temporary mode switch, sample catalog/cart/orders and duplicate page tree are removed.

Routes compose actual features. `UserBoundary`/`RequireAuth` protect private navigation; `AuthProvider` restores the real session. `CommerceProvider` manages API-derived customer/guest carts and wishlist with owner/epoch fencing, explicit merge, current quotes and uncertain-write recovery. It does not persist fictional products or own money/stock authority.

`StoreProvider` supplies bootstrap/operations. `components/store/home.tsx` composes the approved hero, promos, discovery strip, categories, collection tabs and lower promotion. Shared product/category cards, the navy footer and account/auth frames supply one presentation system. There is no alternate `Live*` component choice.

`lib/api/` contains actual projections/transport. Optional public image enrichment is lazy, bounded and canonical-ID checked; cart quotes remain authoritative. Product detail explicitly uses request-time rendering so newly published slugs work after deployment and missing products return 404.

Mutations retain auth, ownership, exact minor-unit amounts, explicit variants, inventory eligibility, idempotency and checkout recovery. Only confirmed Backend state indicates payment/refund success. Provider secrets remain deployment-owned. The API also serves Admin and future Flutter clients.

Controlled API responses exist in tests only. See [E2E guide](E2E_TESTING.md), [consolidation](STOREFRONT_CONSOLIDATION.md) and Master Docs for validation/deployment boundaries.
