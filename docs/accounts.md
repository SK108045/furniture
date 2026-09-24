# Customer accounts

The supplied Clerk publishable and secret keys are configured in `.env`. Only the publishable key reaches the browser. The existing Clerk instance has required verified email and a required password (minimum 15 characters).

The branded forms implement email/password sign-up and sign-in, six-digit email verification, code resending, password reset, and optional email-code sign-in. There are no Google, phone, or other social sign-in buttons in these forms. Google is still enabled in the external Clerk instance; disable it in Clerk's dashboard too if its hosted account portal must also be email-only.

Successful authentication sends customers to `/account`, or back to `/checkout` when started there. Redirects are restricted to the site's known destinations. Header links reflect the current session. Signing out returns to the homepage.

The customer portal includes order history, payment statuses, order summaries and receipts, saved delivery details, and Clerk's profile/security panel. Session-bearing API calls are authenticated by Clerk on the server. Orders are scoped to the authenticated user, and order email comes from Clerk's verified primary email.

The shopping bag remains in this browser across sign-in. Checkout prefills saved delivery details, supports pickup, and requires a signed-in customer before submitting an order.

Set `APP_ORIGIN` to the exact origin used by the browser. For local development, open `http://localhost:4321`. For production, configure Clerk's live instance/domain, set both Clerk keys and `APP_ORIGIN`, then rebuild. Development keys keep Clerk's development notices and restrictions.

The account UI uses Clerk JS 6 (the supported legacy resource methods for custom flows) and Clerk UI 1 for profile management. CAPTCHA is mounted through Clerk on sign-up.

## Portal actions and saved information

The portal displays a furniture assembly animation until account data finishes loading, then reveals the dashboard. Sign-in and verification actions have their own loading state. The animation respects reduced-motion preferences. No artificial loading delay is added.

Delivery profiles are stored in Supabase’s `nicoo_profiles` table, keyed by the authenticated Clerk user ID. Names, contact/default payment phone, pickup/delivery preference, address, instructions, and last-saved timestamp persist across sign-outs, restarts, and devices using the same server. GET/PUT/DELETE `/api/account/profile` power the saved-address card and edit/delete controls. Failed profile loads leave the editor disabled until reload succeeds. Changing a default address never rewrites existing orders.

Orders have search, status filtering, sorting, progressive display, payment status refresh, and activity details. Downloaded HTML summaries/receipts can be opened and printed. Only confirmed payments are labelled receipts.

`PATCH /api/orders/:id` supports `edit`, `copy`, `cancel`, and `pay`. Edits require the current order version, and every lookup is scoped to the authenticated user. Supabase RPC transactions check the order version before committing edits. Run `supabase/schema.sql` once to create the required tables and functions.

- Drafts: save from checkout without requesting a payment, add/remove items, change quantities, edit all details, cancel, or save and request an M-Pesa prompt directly from the portal.
- Payment requested/pending/uncertain: edit the recipient, contact phone, address, delivery preference, and instructions. The original items, amount, and payment phone remain fixed for callback matching.
- Failed: edit delivery or create a separate editable revision at current catalogue prices. The original attempt remains available for late payment reconciliation.
- Paid: edit delivery or create a fresh reorder draft. The original paid items and receipt stay unchanged. Customers are told to contact the shop as well if dispatch has already been arranged.
- Cancelled drafts: retained in history; can be copied into a new draft.

The portal polls pending payments while visible, for up to 20 refreshes, and pauses refreshes while an editor or order action has focus. Manual refresh remains available. There are no invented delivery/shipping statuses: payment state is shown from the actual saved order.
