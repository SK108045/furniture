# Customer accounts

The supplied Clerk publishable and secret keys are configured in `.env`. Only the publishable key reaches the browser. The existing Clerk instance has required verified email and a required password (minimum 15 characters).

The branded forms implement email/password sign-up and sign-in, six-digit email verification, code resending, password reset, and optional email-code sign-in. There are no Google, phone, or other social sign-in buttons in these forms. Google is still enabled in the external Clerk instance; disable it in Clerk's dashboard too if its hosted account portal must also be email-only.

Successful authentication sends customers to `/account`, or back to `/checkout` when started there. Redirects are restricted to the site's known destinations. Header links reflect the current session. Signing out returns to the homepage.

The customer portal includes order history, payment statuses, order summaries and receipts, saved delivery details, and Clerk's profile/security panel. Session-bearing API calls are authenticated by Clerk on the server. Orders are scoped to the authenticated user, and order email comes from Clerk's verified primary email.

The shopping bag remains in this browser across sign-in. Checkout prefills saved delivery details, supports pickup, and requires a signed-in customer before submitting an order.

Set `APP_ORIGIN` to the exact origin used by the browser. For local development, open `http://localhost:4321`. For production, configure Clerk's live instance/domain, set both Clerk keys and `APP_ORIGIN`, then rebuild. Development keys keep Clerk's development notices and restrictions.

The account UI uses Clerk JS 6 (the supported legacy resource methods for custom flows) and Clerk UI 1 for profile management. CAPTCHA is mounted through Clerk on sign-up.
