import type { APIRoute } from 'astro';
import { requireUser, clerkClient } from '../../../server/auth';
import { body, failure, HttpError, json } from '../../../server/http';
import { db } from '../../../server/database';
import { createOrder, getOrder, publicOrder, updatePayment, type OrderRow } from '../../../server/orders';
import { orderInput } from '../../../server/validation';
import { requestStk } from '../../../server/swifta';
import { applyCallbacks } from '../../../server/callbacks';
import { env } from '../../../server/config';
export const GET: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const orders = db().prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(userId) as OrderRow[];
    return json({orders: orders.map(publicOrder)});
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const key = request.headers.get('Idempotency-Key') || '';
    if (!/^[a-f0-9-]{36}$/i.test(key)) throw new HttpError(400, 'A valid checkout attempt ID is required.');
    if (!env('SWIFTA_API_KEY')) throw new HttpError(503, 'M-Pesa payments are temporarily unavailable.');
    const input = orderInput(await body(request));
    const user = await clerkClient().users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified')?.emailAddress;
    if (!email) throw new HttpError(403, 'Please verify your email before checking out.');
    const {row, created} = createOrder(userId,key,input,email);
    if (created) {
      const result = await requestStk({id:row.id,total:row.total,phone:input.customer.phone});
      updatePayment(row.id,result.status,result.providerId,result.note);
      applyCallbacks(result.providerId || '',row.id);
    }
    return json({order:publicOrder(getOrder(row.id,userId))},created ? 201 : 200);
  } catch (error) { return failure(error); }
};
