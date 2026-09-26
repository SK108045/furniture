import {database,query,rpc} from './database';
import {env} from './config';
import {money} from '../data/products';
type Job={order_id:string;snapshot:any;lease:string;attempts:number;message:Record<string,unknown>|null};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function receiptMessage(order:any,from:string){
  const details=order.details,customer=details.customer;
  const lines=details.items.map((i:any)=>`${i.name} × ${i.quantity} — ${money(i.price*i.quantity)}`);
  const delivery=customer.delivery==='pickup'?'Pickup in Donholm, Nairobi.':`Delivery address: ${customer.address}. Delivery fees are arranged separately.`;
  const text=`Nicoo Furniture — Payment receipt\n\nThank you, ${customer.firstName}. Your M-Pesa payment is confirmed.\nOrder: ${order.id}\nM-Pesa receipt: ${order.receipt}\n\n${lines.join('\n')}\n\nTotal paid: ${money(order.total)}\n${delivery}\n\nContact Nicoo: +254114551129\nThis is a payment receipt, not an eTIMS tax invoice.`;
  const html=`<!doctype html><html><body style="margin:0;background:#f3f1e9;font-family:Arial,sans-serif;color:#26352a"><div style="max-width:600px;margin:32px auto;background:#fff;padding:36px;border-top:5px solid #b8532d"><h1 style="font-size:32px">nicoo<span style="color:#b8532d">.</span></h1><p style="letter-spacing:2px;font-size:11px">PAYMENT RECEIPT</p><h2>Asante, ${escape(customer.firstName)}.</h2><p>Your M-Pesa payment is confirmed.</p><p><strong>Order:</strong> ${escape(order.id)}<br/><strong>M-Pesa receipt:</strong> ${escape(order.receipt)}</p><table style="width:100%;border-collapse:collapse">${details.items.map((i:any)=>`<tr><td style="padding:14px 0;border-bottom:1px solid #ddd">${escape(i.name)} × ${i.quantity}</td><td style="text-align:right;border-bottom:1px solid #ddd">${money(i.price*i.quantity)}</td></tr>`).join('')}</table><h2>Total paid: ${money(order.total)}</h2><p>${escape(delivery)}</p><p>Questions? Contact Nicoo on +254114551129.</p><p style="font-size:11px;color:#73796e">This is a payment receipt, not an eTIMS tax invoice.</p></div></body></html>`;
  return {from,to:[details.email],subject:`Nicoo payment receipt · ${order.id}`,html,text};
}
// Payment success never depends on the email provider being available.
export async function deliverReceipts(orderId:string|null=null,userId:string|null=null,limit=1){
  if(!env('RESEND_API_KEY')||!env('RECEIPT_FROM'))return {configured:false,sent:0};
  let sent=0;
  try {
    const jobs=await rpc<Job[]>('nicoo_claim_receipts',{p_order_id:orderId,p_user_id:userId,p_limit:limit});
    for(const job of jobs){
      const resource=`nicoo_receipt_emails?${query({order_id:`eq.${job.order_id}`,lease:`eq.${job.lease}`,status:'eq.sending'})}`;
      try {
        if(job.snapshot.status!=='paid'||!job.snapshot.receipt||!job.snapshot.details.email)throw new Error('invalid_receipt_snapshot');
        // Freeze the exact request before sending so retries use the same payload.
        const message=job.message||receiptMessage(job.snapshot,env('RECEIPT_FROM'));
        if(!job.message)await database(resource,{method:'PATCH',body:JSON.stringify({message})});
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`nicoo-receipt-${job.order_id}`},body:JSON.stringify(message),signal:AbortSignal.timeout(8000),redirect:'error'});
        if(!response.ok)throw new Error(`email_provider_http_${response.status}`);
        const data=await response.json();if(typeof data.id!=='string')throw new Error('email_provider_missing_id');
        await database(resource,{method:'PATCH',body:JSON.stringify({status:'sent',provider_id:data.id,sent_at:new Date().toISOString(),locked_until:null,last_error:null})});sent++;
      }catch(error){
        console.error('Receipt delivery deferred',{orderId:job.order_id,error:error instanceof Error?error.message:'unknown'});
        await database(resource,{method:'PATCH',body:JSON.stringify({status:'pending',locked_until:null,next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6))).toISOString(),last_error:error instanceof Error?error.message:'unknown'})});
      }
    }
  }catch(error){console.error('Receipt queue unavailable',error instanceof Error?error.message:'unknown');}
  return {configured:true,sent};
}
