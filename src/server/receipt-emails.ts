import {productImage} from '../data/products';
import {database,query,rpc} from './database';
import {env} from './config';
import {money} from '../data/products';
type Job={order_id:string;snapshot:any;lease:string;attempts:number;message:Record<string,unknown>|null};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function receiptOrigin(){
  const vercelHost=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL||'';
  if(vercelHost)return `https://${vercelHost.replace(/^https?:\/\//,'').replace(/\/$/,'')}`;
  const configured=env('APP_ORIGIN').trim().replace(/\/$/,'');
  return /^https:\/\//i.test(configured)?configured:'';
}
function receiptImage(image:unknown){
  const name=String(image||'').replace(/^\/+/, '');
  if(!name||/\.svg(?:\?|$)/i.test(name))return '';
  const origin=receiptOrigin();if(!origin)return '';
  try{return new URL(productImage(name),origin).toString();}catch{return '';}
}
function receiptDate(order:any){
  const raw=order.updated_at||order.updatedAt||order.created_at||order.createdAt;
  if(!raw)return '';
  try{return new Date(raw).toLocaleString('en-KE',{timeZone:'Africa/Nairobi',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return '';}
}
export function receiptMessage(order:any,from:string){
  const details=order.details||{},customer=details.customer||{};
  const customerName=[customer.firstName,customer.lastName].filter(Boolean).join(' ')||'Customer';
  const contact=customer.contactPhone||customer.phone||details.paymentPhone||'';
  const delivery=customer.delivery==='pickup'?'Pickup from Nicoo Funiture Hub, Donholm, Nairobi.':`Delivery to ${customer.address||'the address provided at checkout'}. Delivery charges are arranged separately with the shop.`;
  const paidAt=receiptDate(order);
  const lines=(details.items||[]).map((i:any)=>`${i.name} × ${i.quantity} — ${money(i.price*i.quantity)}`);
  const itemRows=(details.items||[]).map((i:any)=>{
    const image=receiptImage(i.image);
    return `<tr>
      <td style="padding:18px 0;border-bottom:1px solid #e7e2d9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${image?`<td width="82" valign="top"><img src="${escape(image)}" alt="${escape(i.name)}" width="68" height="68" style="display:block;width:68px;height:68px;object-fit:cover;border-radius:10px;border:1px solid #e6e0d6;background:#f5f2eb"/></td>`:''}
          <td valign="top" style="padding:${image?'2px 12px':'2px 0'} 0 0;">
            <div style="font-size:15px;font-weight:700;color:#26352a;line-height:1.35">${escape(i.name)}</div>
            <div style="font-size:12px;color:#72786d;margin-top:6px">Qty ${i.quantity} · ${money(i.price)} each</div>
          </td>
          <td valign="top" align="right" style="padding-top:2px;font-size:14px;font-weight:700;color:#26352a;white-space:nowrap">${money(i.price*i.quantity)}</td>
        </tr></table>
      </td>
    </tr>`;
  }).join('');
  const instructions=customer.note?`<div style="margin-top:6px"><strong>Instructions:</strong> ${escape(customer.note)}</div>`:'';
  const text=`Nicoo Funiture Hub — Payment Receipt

Asante, ${customerName}. Your M-Pesa payment is confirmed.

Order reference: ${order.id}
M-Pesa receipt: ${order.receipt}
${paidAt?`Paid: ${paidAt}\n`:''}Payment method: M-Pesa
Payment status: Confirmed

CUSTOMER
Name: ${customerName}
Email: ${details.email||''}
Phone: ${contact}
Delivery: ${delivery}
${customer.note?`Instructions: ${customer.note}\n`:''}
ITEMS
${lines.join('\n')}

TOTAL PAID: ${money(order.total)}

Nicoo Funiture Hub · Donholm, Nairobi
Questions? +254786387981
This is a payment receipt, not an eTIMS tax invoice.`;

  const html=`<!doctype html><html><body style="margin:0;background:#f2efe7;font-family:Arial,Helvetica,sans-serif;color:#26352a">
  <div style="padding:28px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#fff;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;border:1px solid #e5dfd5">
      <tr><td style="height:6px;background:#b8532d;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:30px 34px 18px">
        <div style="font-size:30px;font-weight:800;letter-spacing:-1px;color:#21352a">Nicoo Funiture Hub<span style="color:#b8532d">.</span></div>
        <div style="margin-top:7px;font-size:10px;letter-spacing:2.1px;color:#7e8579">DONHOLM, NAIROBI · PAYMENT RECEIPT</div>
      </td></tr>
      <tr><td style="padding:8px 34px 30px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">
            <div style="font-size:25px;font-weight:700;line-height:1.2">Asante, ${escape(customerName)}.</div>
            <div style="margin-top:9px;font-size:14px;color:#59645a;line-height:1.6">Your M-Pesa payment has been confirmed. Here’s your Nicoo receipt.</div>
          </td>
          <td align="right" valign="top" style="padding-left:18px">
            <span style="display:inline-block;background:#e9f4e7;color:#315a36;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;white-space:nowrap">✓ PAID</span>
          </td>
        </tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f8f6f0;border-radius:12px">
          <tr><td style="padding:17px 18px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:11px;color:#7c8278;padding:4px 0">ORDER REFERENCE</td><td align="right" style="font-size:13px;font-weight:700;padding:4px 0">${escape(order.id)}</td></tr>
              <tr><td style="font-size:11px;color:#7c8278;padding:4px 0">M-PESA RECEIPT</td><td align="right" style="font-size:13px;font-weight:700;padding:4px 0">${escape(order.receipt)}</td></tr>
              ${paidAt?`<tr><td style="font-size:11px;color:#7c8278;padding:4px 0">PAID</td><td align="right" style="font-size:13px;font-weight:700;padding:4px 0">${escape(paidAt)}</td></tr>`:''}
              <tr><td style="font-size:11px;color:#7c8278;padding:4px 0">METHOD</td><td align="right" style="font-size:13px;font-weight:700;padding:4px 0">M-Pesa</td></tr>
            </table>
          </td></tr>
        </table>

        <div style="margin-top:28px;font-size:11px;letter-spacing:1.7px;color:#7d8478">CUSTOMER DETAILS</div>
        <div style="margin-top:10px;border:1px solid #e8e2d8;border-radius:12px;padding:17px 18px;font-size:13px;line-height:1.75;color:#4d594f">
          <div><strong style="color:#26352a">Name:</strong> ${escape(customerName)}</div>
          <div><strong style="color:#26352a">Email:</strong> ${escape(details.email||'')}</div>
          <div><strong style="color:#26352a">Phone:</strong> ${escape(contact)}</div>
          <div><strong style="color:#26352a">Fulfilment:</strong> ${escape(delivery)}</div>
          ${instructions}
        </div>

        <div style="margin-top:30px;font-size:11px;letter-spacing:1.7px;color:#7d8478">YOUR ITEMS</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${itemRows}</table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:2px solid #26352a">
          <tr><td style="padding:18px 0 5px;font-size:16px;font-weight:700">Total paid</td><td align="right" style="padding:18px 0 5px;font-size:24px;font-weight:800">${money(order.total)}</td></tr>
          <tr><td colspan="2" style="padding-top:4px;font-size:11px;color:#777f73">Furniture subtotal only. Any delivery fee is arranged separately with Nicoo Funiture Hub.</td></tr>
        </table>

        <div style="margin-top:28px;background:#26352a;border-radius:12px;padding:18px 20px;color:#fff">
          <div style="font-size:15px;font-weight:700">Need anything before delivery or pickup?</div>
          <div style="margin-top:7px;font-size:12px;line-height:1.7;color:#dce4dc">Contact Nicoo Funiture Hub on <a href="tel:+254786387981" style="color:#fff">+254 786 387 981</a>. Keep your order reference handy and we’ll sort you out.</div>
        </div>
        <div style="margin-top:18px;text-align:center;font-size:10px;line-height:1.6;color:#8a9087">Nicoo Funiture Hub · Donholm, Nairobi<br/>This is a payment receipt, not an eTIMS tax invoice.</div>
      </td></tr>
    </table>
  </div></body></html>`;
  return {from,to:[details.email],subject:`Nicoo Funiture Hub receipt · ${order.id}`,html,text};
}
async function sendWithResend(order:any){
  if(order.status!=='paid'||!order.receipt||!order.details?.email)throw new Error('invalid_receipt_snapshot');
  const message=receiptMessage(order,env('RECEIPT_FROM'));
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      Authorization:`Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type':'application/json',
      'Idempotency-Key':`nicoo-receipt-${order.id}`,
    },
    body:JSON.stringify(message),
    signal:AbortSignal.timeout(8000),
    redirect:'error',
  });
  if(!response.ok){
    const body=await response.text().catch(()=> '');
    console.error('Resend receipt failed',{orderId:order.id,status:response.status,body:body.slice(0,300)});
    throw new Error(`email_provider_http_${response.status}`);
  }
  const data=await response.json();
  if(typeof data.id!=='string')throw new Error('email_provider_missing_id');
  return data.id as string;
}

async function directReceipt(orderId:string,userId:string|null=null){
  const filters:Record<string,string>={id:`eq.${orderId}`,status:'eq.paid',select:'id,user_id,status,total,details,receipt,created_at,updated_at',limit:'1'};
  if(userId)filters.user_id=`eq.${userId}`;
  const rows=await database<any[]>(`nicoo_orders?${query(filters)}`);
  const order=rows[0];
  if(!order||!order.details?.email||!order.receipt)return 0;
  await sendWithResend(order);
  return 1;
}

// Payment success never depends on the email provider being available.
// Prefer the durable Supabase queue when installed. If that migration has not
// been run yet, a specific paid order can still be delivered directly through
// Resend, using the order ID as Resend's idempotency key.
export async function deliverReceipts(orderId:string|null=null,userId:string|null=null,limit=1){
  if(!env('RESEND_API_KEY')||!env('RECEIPT_FROM'))return {configured:false,sent:0};
  let sent=0;
  try {
    const jobs=await rpc<Job[]>('nicoo_claim_receipts',{p_order_id:orderId,p_user_id:userId,p_limit:limit});
    for(const job of jobs){
      const resource=`nicoo_receipt_emails?${query({order_id:`eq.${job.order_id}`,lease:`eq.${job.lease}`,status:'eq.sending'})}`;
      try {
        if(job.snapshot.status!=='paid'||!job.snapshot.receipt||!job.snapshot.details.email)throw new Error('invalid_receipt_snapshot');
        const message=job.message||receiptMessage(job.snapshot,env('RECEIPT_FROM'));
        if(!job.message)await database(resource,{method:'PATCH',body:JSON.stringify({message})});
        const providerId=await sendWithResend(job.snapshot);
        await database(resource,{method:'PATCH',body:JSON.stringify({status:'sent',provider_id:providerId,sent_at:new Date().toISOString(),locked_until:null,last_error:null})});
        sent++;
      }catch(error){
        console.error('Receipt delivery deferred',{orderId:job.order_id,error:error instanceof Error?error.message:'unknown'});
        await database(resource,{method:'PATCH',body:JSON.stringify({status:'pending',locked_until:null,next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts,6))).toISOString(),last_error:error instanceof Error?error.message:'unknown'})});
      }
    }
    return {configured:true,sent};
  }catch(error){
    console.warn('Receipt queue unavailable; using direct delivery for this order',{orderId,error:error instanceof Error?error.message:'unknown'});
    if(orderId){
      try{sent=await directReceipt(orderId,userId);}
      catch(directError){console.error('Direct receipt delivery failed',{orderId,error:directError instanceof Error?directError.message:'unknown'});}
    }
    return {configured:true,sent};
  }
}

