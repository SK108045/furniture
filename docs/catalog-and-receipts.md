# September catalogue and checkout update

The shop retains the original ten product IDs and adds 30 products from `Furniture_Photos_Organized/furniture_catalog.csv`. Its 33 main photos become optimized WebP assets in `public/images/catalog`; five duplicate screenshots and the text-tag originals are excluded. Three explicitly identified alternate-view pairs share one listing and a manual gallery. Existing order snapshots and old image paths remain intact.

Seven categories cover seating, desks, standing desks, workspace sets, conference tables, reception desks and accessories. CSV amounts are the selling prices. Fourteen products with no indicated price use “Ask for price” and a product-specific WhatsApp enquiry; the server rejects these items at checkout. The generated catalogue is `src/data/organized-products.json`. Prices for those products can be added there by setting `price` and changing `quoteOnly` to false.

## Second photo batch — 27 September

`Furniture_2_Organized/furniture_2_catalog.csv` adds seven listings, with stable IDs 201–207, in `src/data/organized-products-2.json`. The shared product catalogue imports this file, so the collection, product dialogs, shopping bag and server-side checkout use the same prices. There are now 47 furniture listings. Existing product IDs and prices are unchanged.

| ID | Product | Category | Selling price (KSh) |
| --- | --- | --- | ---: |
| 201 | Mesh High-Back Chair with Headrest | Seating | 14,499 |
| 202 | Red & Black Gaming Chair | Seating | 22,000 |
| 203 | Blue & Black Gaming Chair | Seating | 17,500 |
| 204 | Yellow Stacking Chair | Seating | 3,500 |
| 205 | L-Shaped Desk & Mesh Chair Set | Workspace sets | 14,500 |
| 206 | Z-Frame Desk & Mesh Chair Set | Workspace sets | 15,000 |
| 207 | Z-Frame Desk & Leather Chair Set | Workspace sets | 18,500 |

All seven photos are distinct listings. The two Z-frame bundles include different chairs and have different CSV prices; neither is merged with the existing desk-only listing. Original photos remain untouched; the shop uses WebP copies in `public/images/catalog`, capped at 1200px on the longest side (about 852 KB combined). CSV prices remain the selling prices, with reference prices calculated by the existing catalogue rule. No database migration is needed.

## Third photo batch — 27 September

`Furniture_3_Organized/furniture_3_catalog.csv` adds five listings in `src/data/organized-products-3.json`, bringing the shop to 52 furniture listings. Seven optimized WebP images support these listings; the grey desk's two views share a gallery. The CSV groups the perforated metal benches: the black 3-seater is the priced product, and its description identifies the blue installation photo as a reference for alternative colours and configurations.

| ID | Product | Category | Selling price (KSh) |
| --- | --- | --- | ---: |
| 301 | Blue Padded Waiting Bench (3-Seater) | Seating | 17,500 |
| 302 | Black Metal Waiting Bench (3-Seater) | Seating | 13,499 |
| 304 | Cherry Wood Desk & Mesh Chair Set | Workspace sets | 10,999 |
| 305 | Grey Wood Desk & Mesh Chair Set | Workspace sets | Ask for price |
| 307 | Walnut Desk & Headrest Chair Set | Workspace sets | 12,999 |

The grey desk is marked “Coming Soon” in the CSV without a price, so it uses the existing quote-only enquiry flow and cannot be purchased for zero. The repeated Z-frame leather-chair set is already item 207 at KSh 18,500 and is not duplicated. No existing IDs or selling prices change, and no database migration is required.

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
