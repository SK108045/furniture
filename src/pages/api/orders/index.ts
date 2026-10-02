import type { APIRoute } from 'astro';
import { requireUser, clerkClient } from '../../../server/auth';
import { body, failure, HttpError, json } from '../../../server/http';
import { createOrder, getOrder, publicOrder, updatePayment, listOrders, reconcileProviderPayment } from '../../../server/orders';
import { orderInput } from '../../../server/validation';
import { requestStk } from '../../../server/swifta';
import { env } from '../../../server/config';
import {deliverReceipts} from '../../../server/receipt-emails';
export const GET: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    let orders = await listOrders(userId);
    const pending = orders.filter(o=>['requesting','pending','uncertain'].includes(o.status)&&o.provider_id).slice(0,3);
    for(const row of pending){
      try{await reconcileProviderPayment(row);}
      catch(error){console.warn('Order reconciliation deferred',{orderId:row.id,error:error instanceof Error?error.message:'unknown'});}
    }
    if(pending.length)orders=await listOrders(userId);
    if(orders.some(o=>o.status==='paid'))await deliverReceipts(null,userId,3);
    return json({orders: orders.map(publicOrder)});
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const key = request.headers.get('Idempotency-Key') || '';
    if (!/^[a-f0-9-]{36}$/i.test(key)) throw new HttpError(400, 'A valid checkout attempt ID is required.');
    const payload = await body(request);
    const draft = payload?.action === 'draft';
    if (!draft && !env('SWIFTA_API_KEY')) throw new HttpError(503, 'M-Pesa payments are temporarily unavailable.');
    const input = await orderInput(payload);
    const user = await clerkClient().users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified')?.emailAddress;
    if (!email) throw new HttpError(403, 'Please verify your email before checking out.');
    const {row, created} = await createOrder(userId,key,input,email,draft);
    if (created && !draft) {
      const result = await requestStk({id:row.id,total:row.total,phone:input.customer.phone});
      await updatePayment(row.id,result.status,result.providerId,result.note);
    }
    return json({order:publicOrder(await getOrder(row.id,userId))},created ? 201 : 200);
  } catch (error) { return failure(error); }
};
