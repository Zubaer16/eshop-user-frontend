# Payment Integration — Stripe Test Mode

**Current state, 2026-11-13:** the single Storefront uses the existing Backend checkout/reservation/order/TEST-payment APIs. The former disabled sample checkout has been removed. Earlier planning notes below are historical; actual gates, signed webhook/reconciliation and deployment configuration follow the Backend payment/showcase documentation. Only confirmed Backend state indicates paid/refunded; this cleanup does not enable live cards or execute provider writes. See [consolidation](STOREFRONT_CONSOLIDATION.md).

## Selected approach

Stripe **test mode** will be used for checkout integration and end-to-end testing when the backend is approved for development. **There is no active Stripe integration in this repository.** Buttons that could place orders or charge cards must remain disabled until secure server integration is available and tested.

## Architecture

1. Storefront sends product/variant identifiers and quantities to a secure commerce API. Never send client-calculated payable totals as authority.
2. Backend validates items, destination-country eligibility, server prices, delivery/tax rules and stock, and creates an order or short-lived quote with idempotency protection.
3. Backend creates a Stripe Checkout Session in **test mode** using server-only test credentials and approved supported currency/payment-method settings. The website redirects to the returned session URL.
4. Backend verifies Stripe webhook signatures, handles duplicate/out-of-order events, and records payment results and inventory/order transitions transactionally. A success URL alone does not confirm payment.
5. Website retrieves the actual order status from the backend for confirmation, cancellation or failure messaging.

## Security and compliance

- Keep Stripe test secret keys (`sk_test_…`) and webhook secrets (`whsec_…`) only in backend environment variables, never in GitHub or `NEXT_PUBLIC_*`.
- Publishable test keys (`pk_test_…`) may be client-visible **only if the chosen frontend integration needs one**. None are needed for the current preview.
- Use official Stripe test cards only in test mode; never use real card information for testing.
- Stripe account/payment support, merchant eligibility, settlement capabilities and currency availability depend on the business's registered jurisdiction and Stripe's current country availability. Merchant eligibility must be verified before integration.
- Configure Stripe products/prices, refunds, error handling, test webhooks and order reconciliation before launch. Test mode does not collect real payments.
- Switching to live mode is a separate approval/release process with different credentials and compliance obligations.

## Current status

Payment is **planned, not implemented**. No API routes, server sessions, webhooks, credentials or payment SDK have been added to the storefront.
