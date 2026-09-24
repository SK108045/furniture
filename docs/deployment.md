# Supabase + Vercel deployment

1. Open this project's Supabase dashboard → SQL Editor. Paste and run the entire `supabase/schema.sql` file. It creates the four tables and transactional functions the app needs. Re-running the schema does not erase data.
2. To keep the existing local history, run `npm run db:export-legacy`, then run the generated `data/supabase-legacy.sql` in the same SQL Editor **after** the schema. The export preserves local SQLite and does not overwrite existing cloud records. It includes customer data, so remains in the ignored `data/` folder.
3. Use Node.js 22 locally and run `npm ci`, `npm run db:check`, `npm run check`, and `npm run build`.
4. Push the repository to GitHub and import it in Vercel. Select Astro and Node.js 22.x. Use the default root directory (this folder), `npm ci`, and `npm run build`. Leave the output-directory override disabled. The adapter generates `.vercel/output`.
5. Configure the website domain in Clerk. For production accounts, replace the Clerk test keys with the live instance keys. Supabase order ownership uses Clerk user IDs, so accounts in different Clerk instances have separate histories.
6. Point Swifta callbacks at the deployed furniture domain as described in `docs/payments.md`. Keeping the callback at Parseify will not automatically update this app unless Parseify forwards those events here.

## Credentials and origins

The project's `.env` contains the supplied Supabase URL and server secret, plus Clerk and Swifta credentials. It is intentionally supported at build time for the requested private-repository deployment workflow. Server keys stay in the server function bundle; only `PUBLIC_CLERK_PUBLISHABLE_KEY` is browser-visible. Vercel environment settings are optional overrides. Redeploy after editing `.env`.

`APP_ORIGIN=http://localhost:4321` is used locally. On Vercel the local value is ignored and Vercel deployment/production addresses plus the current request origin are allowed. For your custom domain you can also set `APP_ORIGIN=https://your-domain.example`.

No database password, SQLite file, native database package, or persistent disk is needed in Vercel. The Supabase secret uses the HTTPS Data API from server functions. RLS is enabled and customer browsers cannot directly read/write these tables with a publishable key. The server verifies Clerk sessions and scopes account requests to the signed-in user.

## What is stored where

| Data | Storage |
| --- | --- |
| Login credentials, verified email, sessions | Clerk |
| Orders, draft items, delivery details, history, totals, status, receipt | Supabase `nicoo_orders` |
| Saved default address and contact details | Supabase `nicoo_profiles` |
| Normalized payment callback events | Supabase `nicoo_payment_callbacks` |
| Reused checkout attempt references | Supabase `nicoo_checkout_attempts` |
| Current shopping bag | Browser local storage |
| Product catalogue, prices and photos | Repository |

The visit-page enquiry preview and AI chat do not currently save submissions/conversations. Redeploying does not erase any Supabase records. Orders and profiles follow the same Clerk account across devices.

`npm run preview` is not supported by the Vercel adapter; use `npm run dev` locally or a Vercel preview deployment. No development server needs to run after deploying.
