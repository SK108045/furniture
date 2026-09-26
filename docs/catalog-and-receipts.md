# September catalogue and checkout update

The shop retains the original ten product IDs and adds 30 products from `Furniture_Photos_Organized/furniture_catalog.csv`. Its 33 main photos become optimized WebP assets in `public/images/catalog`; five duplicate screenshots and the text-tag originals are excluded. Three explicitly identified alternate-view pairs share one listing and a manual gallery. Existing order snapshots and old image paths remain intact.

Seven categories cover seating, desks, standing desks, workspace sets, conference tables, reception desks and accessories. CSV amounts are the selling prices. Fourteen products with no indicated price use “Ask for price” and a product-specific WhatsApp enquiry; the server rejects these items at checkout. The generated catalogue is `src/data/organized-products.json`. Prices for those products can be added there by setting `price` and changing `quoteOnly` to false.

## KSh 1 checkout check

Visit `/payment-test`. Its standalone form does not require sign-in or a shopping bag. Enter a phone number and optionally a receipt email; the server fixes the amount at KSh 1. A signed HttpOnly browser cookie protects test status access. Test attempts share a database-backed limit of five per ten minutes. This sends a real M-Pesa request; confirm the KSh 1 amount on your phone. No furniture is included. Existing bags containing only the old test item redirect here from checkout. Normal furniture purchases still require sign-in.

Check: payment button shows its spinner and chair loader; the order first awaits payment; an authenticated matching Swifta callback changes it to paid with a real M-Pesa receipt; the test page displays its receipt reference. Guest tests do not appear in a Clerk account; normal furniture purchases still appear in the customer portal. No live payment was triggered during this implementation.

## Receipt email setup

Clerk remains responsible for authentication emails and the customer's verified email address. Purchase receipts are sent through Resend, using the verified email saved with the order.

1. Run `supabase/receipt-emails.sql` in Supabase SQL Editor after the existing schema. It adds a receipt outbox and an atomic paid-order trigger. It does not backfill or email old paid orders.
2. Configure `RESEND_API_KEY` and `RECEIPT_FROM` in `.env` (or Vercel settings). Use a sender on your verified Resend domain, e.g. `Nicoo Furniture <receipts@your-domain.example>`. Empty placeholders are intentional until a provider account is supplied.
3. For automatic daily retries, copy the generated `CRON_SECRET` from `.env` into the Vercel project's environment settings as well. Vercel itself needs that setting to authenticate its scheduled request; a bundled fallback alone cannot configure the scheduler. Redeploy after changing configuration.
4. Ensure Swifta callbacks reach this furniture app's callback/webhook handler. A callback still going only to Parseify will not mark the furniture order paid or queue its receipt.

Receipts are queued only for paid orders with a receipt. The queue snapshots order details so later address edits cannot change an in-flight email. Email-provider failures never turn a successful payment into a failed payment. Delivery is attempted after callbacks, after an early callback is reconciled with its STK response, when paid orders are refreshed, after merchant reconciliation, and through a daily Vercel cron (06:00 UTC, batch of three). For larger stores, configure a more frequent external schedule with the same bearer secret or a suitable Vercel plan.

The worker uses a database lease and a stable Resend idempotency key to avoid duplicate emails. It saves the exact request before dispatch. Unresolved attempts older than 23 hours move to `review` because Resend deduplication expires after 24 hours. Inspect provider logs before resetting a review job; do not blindly resend. `sent` means the email provider accepted the message, not guaranteed inbox delivery. Monitor delivery/bounces in Resend.

Until the migration and sender settings are configured, live receipt emails are not enabled. Paid customers can still download their receipt from the account portal.
