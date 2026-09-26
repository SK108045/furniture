# Nicoo Furniture

An Astro storefront for Nicoo Furniture in Donholm, Nairobi, with Clerk accounts, a customer portal and Swifta M-Pesa STK checkout.

```bash
npm ci
npm run dev
```

Open `http://localhost:4321`. The supplied credentials are in the local `.env`; the example file documents all settings.

## Deploy to Vercel

Use Node.js 22. Run [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL Editor, then import this repository into Vercel with the Astro preset. The adapter and `vercel.json` configure the server functions; leave the output directory at its default. See [deployment steps](docs/deployment.md).

The supplied credentials are in `.env`. Astro reads them during the build and includes server credentials only in the server bundle. This supports your committed `.env` workflow; changing credentials requires a redeploy. Vercel project environment settings can optionally override them. No local database or persistent Vercel disk is required.

```bash
npm run db:check
npm run check
npm run build
```

## Features

Latest catalogue and receipt setup: [September catalogue and checkout update](docs/catalog-and-receipts.md). The shop now has 40 listings in seven categories, with a separate `/payment-test` page for a real KSh 1 checkout check. Receipt emails require the additional Supabase migration and a configured email sender described in that guide.

- Email sign-up/sign-in, email verification, password reset, email-code sign-in and sign-out through Clerk.
- Customer portal with order search, filters, sorting, payment activity, downloadable printable summaries/receipts, editable delivery details and Clerk profile/security management.
- Save an editable order draft from checkout, revise failed orders, reorder past purchases, change draft quantities/products, cancel drafts, and pay a draft directly from the portal.
- Saved delivery profiles persist in Supabase per Clerk account, with a saved-address card, edit/discard/delete controls and automatic checkout prefill.
- Animated furniture loader during sign-in and account loading, with reduced-motion support and explicit loading/error states.
- Shopping bag retained in the browser, delivery/pickup checkout and server-priced orders.
- Swifta STK push with generated Nicoo order references, payment status updates and callback/webhook handlers.
- M-Pesa checkout branding, step-by-step phone payment guidance, loading/error/retry states and account links.
- Donholm map and directions on `/visit`.
- Hero entrances, moving sunlight, floating price card, rotating Nairobi stamp, CTA shimmer and pointer-responsive light; pause and reduced-motion support.

See [accounts](docs/accounts.md) and [payments](docs/payments.md) for the integration details. STK uses the supplied API endpoint directly. Automatic confirmation requires Swifta to send events to this app's public callback/webhook URL; existing Parseify URLs are not modified.

## Edit the store

- Catalogue and prices: `src/data/products.ts`
- Contact information: `src/data/contact.ts`
- Checkout: `src/pages/checkout.astro` and `src/scripts/checkout.ts`
- Account portal: `src/pages/account.astro` and `src/scripts/account.ts`
- Authentication: `src/scripts/auth.ts` and `src/scripts/client.ts`
- Server/payment code: `src/server/`, `src/pages/api/`
- Visual styling: `src/styles/`
- Homepage motion: `src/scripts/showroom.ts`

The prices transcribed from the supplied photos are the selling prices. Higher original/reference prices are calculated above them (selling price divided by 0.9, rounded up to KSh 500); no further discount is subtracted at checkout. Savings badges are calculated from those two prices. Product names and descriptions remain illustrative. Delivery is arranged separately with the shop. The map points to Donholm rather than an unverified shop entrance. The visit enquiry form remains a local preview; phone and WhatsApp links connect customers to the shop.

Original supplied photos remain in `Furniture_Images/`. Website copies are in `public/images/`; lifestyle image prompts are documented in [lifestyle assets](docs/lifestyle-assets.md).
