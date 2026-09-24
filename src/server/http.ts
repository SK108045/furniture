export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Please send JSON.');
  const text = await request.text();
  if (text.length > 16000) throw new HttpError(413, 'The request is too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid request.'); }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({error: error.message}, error.status);
  console.error('Nicoo API error:', error instanceof Error ? error.name : 'Unknown error');
  return json({error: 'Something went wrong. Please try again shortly.'}, 500);
}
