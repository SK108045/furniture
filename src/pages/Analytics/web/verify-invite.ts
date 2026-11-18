import type { APIRoute } from 'astro';

const verifyUrl = 'https://g-analytics-invite.johnwakaba146.workers.dev/verify';

function json(body: object, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const token = body?.token;
  if (typeof email !== 'string' || typeof token !== 'string' || !email || !token || /[<>]/.test(email)) {
    return json({ ok: false, error: 'This invitation link is incomplete or invalid.' }, 400);
  }

  try {
    const upstream = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (upstream.status === 401) {
      return json({ ok: false, error: 'Invalid or expired invitation.' }, 401);
    }
    if (upstream.ok) {
      const result = await upstream.json();
      if (result.ok === true && result.email === email && ['Viewer', 'Analyst'].includes(result.role)) {
        return json({ ok: true, email: result.email, role: result.role }, 200);
      }
    }
  } catch {
    // Leave the invitation unverified if the verification service is unavailable.
  }
  return json({ ok: false, error: 'Invitation verification is temporarily unavailable. Try again shortly.' }, 502);
};
