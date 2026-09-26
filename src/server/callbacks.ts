import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {database,query,rpc} from './database';
import {deliverReceipts} from './receipt-emails';
import {env} from './config';
import {HttpError} from './http';
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function authorizeCallback(request: Request) {
  const expected=env('SWIFTA_CALLBACK_TOKEN');
  const supplied=request.headers.get('x-webhook-secret') || new URL(request.url).searchParams.get('token') || '';
  if(!expected)throw new HttpError(503,'Callback has not been configured.');
  if(!equal(expected,supplied))throw new HttpError(401,'Invalid callback token.');
}
export function authorizeWebhook(request:Request,raw:string){
  // Same raw-body HMAC contract as the existing Parseify /api/swifta/webhook.
  const secret=env('SWIFTA_WEBHOOK_SECRET');
  if(!secret)throw new HttpError(503,'Webhook secret has not been configured.');
  const signature=(request.headers.get(env('SWIFTA_WEBHOOK_SIGNATURE_HEADER')||'X-Swifta-Signature')||'').replace(/^sha256=/i,'').trim().toLowerCase();
  const expected=createHmac('sha256',secret).update(raw).digest('hex');
  if(!equal(expected,signature))throw new HttpError(401,'Invalid webhook signature.');
}
// Daraja envelopes and the flat Swifta payload fields used by Parseify.
export function normalizeCallback(body: any) {
  const callback=body?.Body?.stkCallback || body?.stkCallback || body?.data || body;
  const providerId=callback?.CheckoutRequestID || callback?.checkoutRequestId || callback?.checkout_request_id || '';
  const event=body?.event || body?.event_type || body?.type;
  const rawReference=callback?.reference || callback?.transaction_reference || callback?.account_reference || callback?.accountReference || callback?.order_id || callback?.external_reference || callback?.BillRefNumber || '';
  const reference=String(rawReference).match(/NF-\d{6}-[A-F0-9]{8}/)?.[0] || '';
  const eventCode=event==='payment.success'?0:['payment.failed','stk.timeout'].includes(event)?1:undefined;
  const code=callback?.ResultCode ?? callback?.resultCode ?? callback?.result_code ?? eventCode;
  if((!providerId&&!reference)||typeof providerId!=='string'||providerId.length>200||code===undefined||!Number.isInteger(Number(code)))throw new HttpError(400,'Missing payment reference or result code.');
  const metadata=Array.isArray(callback.CallbackMetadata?.Item)?Object.fromEntries(callback.CallbackMetadata.Item.map((i:any)=>[i.Name,i.Value])):callback;
  const amount=metadata.Amount ?? metadata.amount;
  const phone=metadata.PhoneNumber ?? metadata.phone_number ?? metadata.phone ?? metadata.msisdn;
  const receipt=metadata.MpesaReceiptNumber ?? metadata.mpesaReceiptNumber ?? metadata.mpesa_receipt_number ?? metadata.receipt_number ?? metadata.receipt ?? metadata.trans_id;
  if(Number(code)===0&&(!Number.isSafeInteger(Number(amount))||typeof receipt!=='string'||!/^[A-Z0-9]{8,30}$/i.test(receipt)||!/^(?:\+?254|0)[17]\d{8}$/.test(String(phone))))throw new HttpError(400,'Successful callbacks require amount, phone and M-Pesa receipt.');
  return {providerId,reference,code:Number(code),amount:Number(amount)||0,phone:String(phone||'').replace(/^\+?254/,'0'),receipt:typeof receipt==='string'?receipt.toUpperCase():null};
}
type Callback=ReturnType<typeof normalizeCallback>;
export async function applyCallbacks(providerId:string,reference='') {
  await rpc('nicoo_apply_callbacks',{p_provider_id:providerId,p_reference:reference});
}
export async function receiveCallback(payload:Callback) {
  const id=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await rpc('nicoo_receive_callback',{p_id:id,p_payload:payload});
  if(env('RESEND_API_KEY')&&env('RECEIPT_FROM')){
    // Daraja callbacks often contain only CheckoutRequestID, not our order ID.
    try {
      const orderId=payload.reference||(await database<{id:string}[]>(`nicoo_orders?${query({provider_id:`eq.${payload.providerId}`,select:'id',limit:'1'})}`))[0]?.id;
      if(orderId)await deliverReceipts(orderId);
    }catch(error){console.error('Receipt lookup deferred',error instanceof Error?error.name:'unknown');}
  }
}
