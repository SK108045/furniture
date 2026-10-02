# Admin furniture uploads

The new page is `/admin/products`. It adds new furniture to the live collection, category filters, product dialogs, shopping bag, checkout, order drafts, enquiry selector and Gemini chat without changing existing catalogue files or prices. Publishing is immediate; no rebuild is needed. New listings use the admin's exact selling price and do not receive an invented discount.

## One-time setup

1. Run `supabase/admin-products.sql` in this project's Supabase SQL Editor. This creates only the new `nicoo_products` table and the public-read `nicoo-products` photo bucket. Existing tables and data stay intact. Product rows and photo writes are server-only.
2. Open `/admin/products` and use the standalone shop login: username `admin`, password from `ADMIN_UPLOAD_PASSWORD` in the server `.env`. The generated password is already configured for this deployment.
3. No Clerk account, admin role or customer sign-in is needed. The session lasts eight hours and the page has its own Log out button.

The existing Supabase and Gemini settings are reused. Only `ADMIN_UPLOAD_PASSWORD` and `ADMIN_UPLOAD_SESSION_SECRET` are added to `.env`; existing values stay intact. Change the password and redeploy to invalidate existing sessions. The password never goes into the public browser bundle; the server sets a signed HttpOnly session cookie after login. Uploads require that session.

## Using the page

Choose a JPG, PNG or WebP photo (up to 20 MB on the device), enter a whole-shilling price from KSh 1 to 150,000, and optionally add a name or select one of the existing categories. The browser reduces the photo to a maximum of 1600 pixels and a 3 MB upload; the server decodes and sanitises it again before storing a JPEG.

The same Gemini model as chat checks the photo, preserves reasonable names/categories, fills missing details and corrects obvious mismatches. Its output is constrained to the existing seven categories. It never sets the selling price. If Gemini is unavailable, a complete manually entered name and valid category can still be published, with a notice. Otherwise the form keeps the photo/details and asks the admin to fill them in or retry.

Successful uploads are listed on the admin page with a link to the public product. Retrying the same upload ID returns the existing listing instead of creating a second product. Photo storage is compensated if saving a product fails; ambiguous database failures retain the photo rather than risk deleting a published image.

Existing pages continue to serve their original catalogue if the new table is not ready or Supabase reads fail; the admin page instead shows a setup/error message. Uploaded items require Supabase to be available. Server-priced checkout always reads the current catalogue and never trusts a price supplied by the browser.

## Validation

Run `npm run check`, `npm run build`, and `node --import tsx --test tests/admin-products.test.ts tests/admin-products-ssr.test.ts tests/auth-config.test.mjs`. With a Playwright Chromium installation, also run `node --import tsx --test tests/admin-products-browser.test.ts` (or provide `CHROMIUM_EXECUTABLE_PATH`). The browser test checks the form at desktop, 390px and 320px widths, photo submission, the category assignment confirmation and the public bag/checkout using local fixtures. Live upload verification requires the migration and the shop password. No fake product or payment is sent to production.

The production build and the login/upload tests pass. `astro check` reports the same 18 pre-existing errors in the unchanged `src/pages/owner-pricing.astro` as the baseline; the new feature adds no diagnostics.
