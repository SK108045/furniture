import type {APIRoute,AstroCookies} from 'astro';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {env,appOrigins} from '../../server/config';
import {body,json,failure,HttpError} from '../../server/http';
import {createOrder,getOrder,reconcilePayment,updatePayment} from '../../server/orders';
import {orderInput} from '../../server/validation';
import {pollStk,requestStk} from '../../server/swifta';
import {deliverReceipts} from '../../server/receipt-emails';
const owner='nicoo-public-payment-test'; // Shared database-backed limit: five requests per ten minutes.
const cookieName='nicoo-payment-test';
function signature(value:string){const key=env('SWIFTA_CALLBACK_TOKEN');if(!key)throw new HttpError(503,'Payment tests are not configured.');return createHmac('sha256',key).update(value).digest('hex');}
function session(cookies:AstroCookies,create=false,secure=false){
  const value=cookies.get(cookieName)?.value||'';const [id,sig]=value.split('.');
  if(/^[a-f0-9]{48}$/.test(id||'')&&/^[a-f0-9]{64}$/.test(sig||'')&&timingSafeEqual(Buffer.from(sig),Buffer.from(signature(id))))return id;
  if(!create)throw new HttpError(401,'Reload the test page before requesting payment.');
  const next=randomBytes(24).toString('hex');cookies.set(cookieName,`${next}.${signature(next)}`,{httpOnly:true,sameSite:'strict',secure,path:'/api/payment-test',maxAge:86400});return next;
}
function summary(row:Awaited<ReturnType<typeof getOrder>>){return {id:row.id,status:row.status,total:row.total,receipt:row.receipt,paymentNote:row.payment_note};}
export const GET:APIRoute=async({cookies,url})=>{
  try{
    const id=url.searchParams.get('id');const token=session(cookies,!id,url.protocol==='https:');
    if(!id)return json({ready:true});
    let row=await getOrder(id,owner);
    if(row.details.customer.note!==`Test session ${token}`)throw new HttpError(404,'Test payment not found in this browser.');

    // The callback/webhook is still the fastest path, but a checkout page must not
    // remain stuck when a callback is delayed or misconfigured. Reconcile the
    // saved CheckoutRequestID against Swifta's documented public poll endpoint.
    if(['requesting','pending','uncertain'].includes(row.status)&&row.provider_id){
      const provider=await pollStk(row.provider_id);
      if(provider.status==='success'&&provider.receipt){
        try{await reconcilePayment(row.id,'paid',provider.receipt);}
        catch(error){
          const latest=await getOrder(id,owner);
          if(latest.status!=='paid')throw error;
        }
        row=await getOrder(id,owner);
      }else if(provider.status==='failed'||provider.status==='cancelled'){
        try{await reconcilePayment(row.id,'failed');}
        catch(error){
          const latest=await getOrder(id,owner);
          if(!['paid','failed'].includes(latest.status))throw error;
        }
        row=await getOrder(id,owner);
      }
    }
    if(row.status==='paid')await deliverReceipts(row.id);
    return json({order:summary(row)});
  }catch(error){return failure(error);}
};
export const POST:APIRoute=async({request,cookies,url})=>{
  try{
    const origin=request.headers.get('origin');if(!origin||!appOrigins(request).includes(origin))throw new HttpError(403,'Open the test from this website.');
    const token=session(cookies,false,url.protocol==='https:');
    if(!env('SWIFTA_API_KEY'))throw new HttpError(503,'Payments are not configured.');
    const key=request.headers.get('Idempotency-Key')||'';if(!/^[a-f0-9-]{36}$/i.test(key))throw new HttpError(400,'A valid attempt ID is required.');
    const input=await body(request);const email=typeof input.email==='string'?input.email.trim():'';
    if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))throw new HttpError(400,'Enter a valid receipt email or leave it empty.');
    const priced=orderInput({items:[{id:9001,quantity:1}],customer:{firstName:input.firstName,lastName:input.lastName,phone:input.phone,delivery:'pickup',note:`Test session ${token}`}});
    const {row,created}=await createOrder(owner,key,priced,email);
    if(row.details.customer.note!==`Test session ${token}`)throw new HttpError(409,'Start a new test from this browser.');
    if(created){const result=await requestStk({id:row.id,total:1,phone:priced.customer.phone});await updatePayment(row.id,result.status,result.providerId,result.note);}
    return json({order:summary(await getOrder(row.id,owner))},created?201:200);
  }catch(error){return failure(error);}
};
