# Single storefront consolidation — 2026-11-13

Final local validation on Node 24.21.0: structural/canonical API guards, standalone TypeScript/lint, production build, 55 retained unit tests and the single 18-test Storefront browser suite PASS with no retries/skips/failures. Backend strict alignment (7 MATCH/15 ADAPTER/0 REVIEW_REQUIRED), four audit-tool tests, source integration audit, changed-file lint and web-test TypeScript PASS. Old sample-only browser tests were removed rather than rerun. No deployment or full guarded real-DB/provider acceptance is claimed.

The owner clarified that the pre-Backend UI was the final design reference, not a permanent second mode. The follow-up authorizes one UI with real API content/actions and removal of the temporary rendering/testing system. This supersedes the earlier restoration record's separate-mode architecture; historical audit records remain provenance only.

Removed mode switching from pages, auth/commerce/catalog/store/push providers, metadata, navigation and branding. Removed the fictional catalog, local Zustand cart/wishlist, sample orders/tracking/checkout, draft fixture adapters/types, localization helpers and duplicate components. There is no runtime sample fallback or auth bypass.

API-backed design components are now canonical `home.tsx`, `product-card.tsx`, `category-tile.tsx`, `store-content.tsx` and `layout/footer.tsx`. Normal feature exports replace `Live*` names. The approved composition/responsive design is retained. Working sign-in/sign-up forms use the established two-column design frame; no unsupported registration fields were added.

Old sample-only E2E files/helpers, mode-specific scripts and fixture-based verification were removed. The single suite checks actual API-shaped UI/session/commerce contracts and error/ownership boundaries; security unit regressions remain. Unused Zustand/Sonner dependencies and toaster were removed from package/lockfile. Decorative artwork remains where used by the design.

Backend source audits now inspect actual Storefront catalog/shopping/checkout types and the renamed store-content component. Missing files still fail the gate; canonical UUID/selection guards remain required. Backend routes/business rules/schema are unchanged. Admin's own presentation architecture is outside this Storefront cleanup.

Run commands in [README](../README.md) and [E2E guide](E2E_TESTING.md); final results are recorded in the three Master Docs. Controlled unit/browser responses are test infrastructure, never a shipped business-data source.

Persistent HttpOnly sessions, canonical money/stock/ownership, guest-cart merge, checkout recovery and TEST payment gates remain authoritative. No migration, DB reset, actual customer/cart/order/payment/provider write, commit/push or deployment is part of this cleanup. Application code no longer reads the obsolete mode environment key; local environment files were not rewritten.

Real-DB cross-app/provider/deployed-origin acceptance remains separate. Owner brand/contact/policy data still requires real configuration through Admin.
