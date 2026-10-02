// Server-only. Explicit build-time fallbacks support the requested committed .env
// workflow; Vercel project environment values can still override them at runtime.
const bundled: Record<string, string | undefined> = {
  PUBLIC_CLERK_PUBLISHABLE_KEY: import.meta.env?.PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: import.meta.env?.CLERK_SECRET_KEY,
  SUPABASE_URL: import.meta.env?.SUPABASE_URL,
  SUPABASE_SECRET_KEY: import.meta.env?.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: import.meta.env?.SUPABASE_SERVICE_ROLE_KEY,
  SWIFTA_API_KEY: import.meta.env?.SWIFTA_API_KEY,
  SWIFTA_CALLBACK_TOKEN: import.meta.env?.SWIFTA_CALLBACK_TOKEN,
  SWIFTA_WEBHOOK_SECRET: import.meta.env?.SWIFTA_WEBHOOK_SECRET,
  SWIFTA_WEBHOOK_SIGNATURE_HEADER: import.meta.env?.SWIFTA_WEBHOOK_SIGNATURE_HEADER,
  GEMINI_API_KEY: import.meta.env?.GEMINI_API_KEY,
  RESEND_API_KEY: import.meta.env?.RESEND_API_KEY,
  RECEIPT_FROM: import.meta.env?.RECEIPT_FROM,
  CRON_SECRET: import.meta.env?.CRON_SECRET,
  OWNER_PRICING_CODE: import.meta.env?.OWNER_PRICING_CODE,
  APP_ORIGIN: import.meta.env?.APP_ORIGIN,
  ADMIN_UPLOAD_PASSWORD: import.meta.env?.ADMIN_UPLOAD_PASSWORD,
  ADMIN_UPLOAD_SESSION_SECRET: import.meta.env?.ADMIN_UPLOAD_SESSION_SECRET,
};
export function env(name: string): string {
  return process.env[name] || bundled[name] || '';
}
export function appOrigins(request: Request) {
  const origins = new Set<string>();
  const deployed = process.env.VERCEL === '1';
  const configured = env('APP_ORIGIN');
  if (configured && !(deployed && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured))) origins.add(new URL(configured).origin);
  for (const hostname of [process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL]) if(hostname) origins.add(`https://${hostname}`);
  // Vercel routes only domains attached to this deployment. Include that routed
  // origin for preview URLs and custom domains, without baking localhost into auth.
  if (deployed) origins.add(new URL(request.url).origin);
  if (!origins.size) origins.add('http://localhost:4321');
  return [...origins];
}
