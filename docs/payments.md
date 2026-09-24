# Nicoo M-Pesa payments

The checkout sends the exact Swifta request shape supplied for this project:

- `POST https://app.swifta.co.ke/stkpush`
- `x-api-key: SWIFTA_API_KEY` (server only)
- JSON: `phone`, `amount`, `accountReference`, `description`

The phone is normalized to `07…` / `01…`, the amount is calculated from the server catalogue, and `accountReference` is `Nicoo Furnitures NF-YYMMDD-XXXXXXXX`. The customer sees the generated Nicoo order reference immediately. The M-Pesa receipt number comes from the successful payment callback; it is not invented by the shop.

A verified Clerk session is required to order. SQLite stores the order before the STK request. The same checkout-attempt ID returns the existing order, preventing repeated clicks or transport retries from requesting payment twice. An interrupted or ambiguous request remains awaiting review. The checkout polls saved status every 10 seconds for five minutes and also offers a manual refresh. Account history always reads the latest saved status.

## Callback connection

The URLs supplied in the conversation (`https://parseify.online/api/swifta/callback` and `/api/swifta/webhook`) belong to the existing Parseify application. This furniture project now implements the same paths on **its own origin**. Deploying this project does not change Parseify or Swifta dashboard configuration.

In Swifta, register the furniture app's publicly reachable URL:

- Callback: `https://YOUR-FURNITURE-DOMAIN/api/swifta/callback?token=VALUE_FROM_SWIFTA_CALLBACK_TOKEN`
- Signed event webhook: `https://YOUR-FURNITURE-DOMAIN/api/swifta/webhook`

The callback token has been generated in the local `.env`. For the signed webhook, put the matching Swifta signing secret in `SWIFTA_WEBHOOK_SECRET`. The header defaults to `X-Swifta-Signature`; a raw-body HMAC-SHA256 hex digest with an optional `sha256=` prefix is accepted, matching the handler in the existing local Parseify project (`Shopify/ui/swifta.py`). No webhook secret was supplied, so that environment value is intentionally empty.

Supported payloads match that existing handler: Daraja `Body.stkCallback`, flat result-code payloads, and signed `payment.success`, `payment.failed`, and `stk.timeout` events. Callbacks correlate by checkout request ID; signed events may correlate by the generated Nicoo reference. Successful events must include the matching amount, phone, and M-Pesa receipt. Duplicate events and late failures do not downgrade a paid order. Events that arrive before the STK response are saved and applied when the response arrives.

Until Swifta is pointed to this app, requests can still send STK prompts, but orders stay awaiting confirmation. A pending prompt is never displayed as a paid receipt. Customer receipts are downloadable from the account page after payment confirmation; unpaid orders download an order summary clearly marked as not a payment receipt.

## Runtime

Run one Node application with a persistent, backed-up `DATABASE_PATH`. SQLite is suitable for this deployment; multiple replicas need a shared transactional database instead. Delivery fees remain separately agreed with the shop and are excluded from the furniture payment, as explained in checkout.

No real STK request or end-to-end payment test was performed during implementation, at the user's request.

## Merchant reconciliation fallback

If the callback has not been connected yet, verify the transaction in Swifta first, then run on the server:

```bash
npm run order:reconcile -- NF-YYMMDD-XXXXXXXX paid MPESA_RECEIPT
# Only after confirming that no payment completed:
npm run order:reconcile -- NF-YYMMDD-XXXXXXXX failed
```

This updates the customer portal and unblocks a failed attempt. Already-paid orders cannot be downgraded by this command.
