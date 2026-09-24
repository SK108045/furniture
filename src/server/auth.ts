import { createClerkClient } from '@clerk/backend';
import { appOrigins, env } from './config';
import { HttpError } from './http';
export function clerkClient() {
  return createClerkClient({secretKey: env('CLERK_SECRET_KEY'), publishableKey: env('PUBLIC_CLERK_PUBLISHABLE_KEY')});
}
export async function requireUser(request: Request) {
  const origin = request.headers.get('origin');
  const origins = appOrigins(request);
  if (origin && !origins.includes(origin)) throw new HttpError(403, 'Request origin is not allowed.');
  // API calls require an explicit bearer token, preventing cookie-based CSRF.
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in to continue.');
  const state = await clerkClient().authenticateRequest(request, {authorizedParties: origins, acceptsToken: 'session_token'});
  const auth = state.toAuth();
  if (!state.isAuthenticated || !auth?.userId) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  return auth.userId;
}
