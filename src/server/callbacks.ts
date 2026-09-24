import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {db} from './database';
import {env} from './config';
import {HttpError} from './http';
import type {OrderRow} from './orders';
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
function callbackStore(){
  const connection=db();
  connection.exec('CREATE TABLE IF NOT EXISTS payment_callbacks (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, reference TEXT NOT NULL, payload TEXT NOT NULL, received_at TEXT NOT NULL, applied INTEGER NOT NULL DEFAULT 0)');
  return connection;
}
export function applyCallbacks(providerId: string,reference='') {
  const connection=callbackStore();
  connection.transaction(()=>{
    const order=connection.prepare("SELECT * FROM orders WHERE (provider_id=? AND ?!='') OR (id=? AND ?!='')").get(providerId,providerId,reference,reference) as OrderRow|undefined;
    if(!order)return;
    const events=connection.prepare("SELECT * FROM payment_callbacks WHERE ((provider_id=? AND ?!='') OR reference=?) AND applied=0 ORDER BY received_at").all(order.provider_id||'',order.provider_id||'',order.id) as {id:string;payload:string}[];
    for(const event of events){
      const payload=JSON.parse(event.payload) as Callback;
      const details=JSON.parse(order.details);
      if(payload.reference&&payload.reference!==order.id)continue;
      if(payload.providerId&&order.provider_id&&payload.providerId!==order.provider_id)continue;
      if(payload.code===0&&(payload.amount!==order.total||payload.phone!==details.customer.phone))continue;
      // A duplicate or late failure never overwrites an already verified payment.
      connection.prepare("UPDATE orders SET status=?,receipt=?,payment_note=?,updated_at=? WHERE id=? AND status!='paid'").run(payload.code===0?'paid':'failed',payload.code===0?payload.receipt:null,payload.code===0?'Your M-Pesa payment is confirmed. Thank you! Contact the shop to arrange delivery or pickup.':'The M-Pesa payment was not completed. You can return to checkout and try again.',new Date().toISOString(),order.id);
      connection.prepare('UPDATE payment_callbacks SET applied=1 WHERE id=?').run(event.id);
    }
  })();
}
export function receiveCallback(payload: Callback) {
  const serialized=JSON.stringify(payload);
  const id=createHash('sha256').update(serialized).digest('hex');
  callbackStore().prepare('INSERT OR IGNORE INTO payment_callbacks (id,provider_id,reference,payload,received_at) VALUES (?,?,?,?,?)').run(id,payload.providerId,payload.reference,serialized,new Date().toISOString());
  applyCallbacks(payload.providerId,payload.reference);
}
