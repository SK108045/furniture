# Nicoo Furniture

An Astro storefront for Nicoo Furniture in Donholm, Nairobi, with Clerk accounts, a customer portal and Swifta M-Pesa STK checkout.

```bash
npm install
npm run dev
```

Open `http://localhost:4321`. The supplied credentials are in the local `.env`; the example file documents all settings.

For a production Node build:

```bash
npm run build
npm run serve
```

This is now a server application, not a static-only site. Set `APP_ORIGIN` to the actual website origin. `DATABASE_PATH` must point to persistent storage for orders, delivery profiles and payment events. The `serve` command loads `.env` at runtime; the public Clerk key is embedded during the build.

## Features

- Email sign-up/sign-in, email verification, password reset, email-code sign-in and sign-out through Clerk.
- Customer portal with order history, payment status, downloadable summaries/receipts, saved delivery details and Clerk profile/security management.
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

Product names and descriptions remain illustrative; the existing marked 10% demo discounts are retained and used consistently across the catalogue, bag and checkout. Delivery is arranged separately with the shop. The map points to Donholm rather than an unverified shop entrance. The visit enquiry form remains a local preview; phone and WhatsApp links connect customers to the shop.

Original supplied photos remain in `Furniture_Images/`. Website copies are in `public/images/`; lifestyle image prompts are documented in [lifestyle assets](docs/lifestyle-assets.md).
