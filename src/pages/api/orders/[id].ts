import type { APIRoute } from 'astro';
import { requireUser, clerkClient } from '../../../server/auth';
import { body, failure, json, HttpError } from '../../../server/http';
import { getOrder, publicOrder, editOrder, copyToDraft, cancelDraft, claimDraftPayment, updatePayment, reconcileProviderPayment } from '../../../server/orders';
import { requestStk } from '../../../server/swifta';
import { env } from '../../../server/config';
import {deliverReceipts} from '../../../server/receipt-emails';
export const GET: APIRoute = async ({request,params}) => {
  try { const userId=await requireUser(request);let row=await getOrder(params.id!,userId);row=await reconcileProviderPayment(row);if(row.status==='paid')await deliverReceipts(row.id,userId);return json({order:publicOrder(row)}); }
  catch (error) { return failure(error); }
};
export const PATCH: APIRoute = async ({request,params}) => {
  try {
    const userId = await requireUser(request);
    const input = await body(request);
    const id = params.id!;
    if (input?.action === 'edit') return json({order:publicOrder(await editOrder(id,userId,input))});
    if (input?.action === 'copy') return json({order:publicOrder(await copyToDraft(id,userId,input.version))},201);
    if (input?.action === 'cancel') return json({order:publicOrder(await cancelDraft(id,userId,input.version))});
    if (input?.action !== 'pay') throw new HttpError(400,'Choose a valid order action.');
    if (!env('SWIFTA_API_KEY')) throw new HttpError(503,'M-Pesa is temporarily unavailable.');
    const user = await clerkClient().users.getUser(userId);
    const email = user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId && e.verification?.status==='verified')?.emailAddress;
    if (!email) throw new HttpError(403,'Verify your account email before paying.');
    const {row,claimed} = await claimDraftPayment(id,userId,input.version,input.phone,email);
    if (claimed) {
      const details = row.details;
      const result = await requestStk({id:row.id,total:row.total,phone:details.paymentPhone});
      await updatePayment(row.id,result.status,result.providerId,result.note);
    }
    return json({order:publicOrder(await getOrder(id,userId))});
  } catch(error) { return failure(error); }
};
