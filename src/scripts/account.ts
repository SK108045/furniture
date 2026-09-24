import {api,authReady,errorMessage} from './client';
import {clearPurchased} from './store';
import {money} from '../data/products';
import {whatsapp} from '../data/contact';
const list=document.querySelector<HTMLElement>('#account-orders')!;
const form=document.querySelector<HTMLFormElement>('#profile-form')!;
const status=document.querySelector<HTMLElement>('#profile-status')!;
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const labels:Record<string,string>={requesting:'Requesting payment',pending:'Awaiting confirmation',uncertain:'Payment needs checking',failed:'Payment request failed',paid:'Payment received'};
let orders:any[]=[];
async function loadOrders(){
  const button=document.querySelector<HTMLButtonElement>('#refresh-orders')!;button.disabled=true;
  try{
    orders=(await api('/api/orders')).orders;
    try{const id=localStorage.getItem('nicoo-active-order');const paid=orders.find(o=>o.id===id&&o.status==='paid');if(paid){clearPurchased(paid.id,paid.items);localStorage.removeItem('nicoo-active-order');sessionStorage.removeItem('nicoo-checkout-attempt');}}catch{}
    document.querySelector('#account-order-count')!.textContent=String(orders.length);
    document.querySelector('#account-pending-count')!.textContent=String(orders.filter(o=>['pending','uncertain','requesting'].includes(o.status)).length);
    list.innerHTML=orders.length?orders.map(order=>`<article class="portal-order"><header><div><span>${escape(new Date(order.createdAt).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'}))}</span><h3>${escape(order.id)}</h3></div><span class="order-status status-${escape(order.status)}">${escape(labels[order.status]||order.status)}</span></header><div class="portal-order-items">${order.items.map((item:any)=>`<div><img src="/images/${escape(item.image)}" alt="${escape(item.name)}" width="76" height="76"/><p><strong>${escape(item.name)}</strong><span>Qty ${escape(item.quantity)} · ${money(item.price)}</span></p><strong>${money(item.quantity*item.price)}</strong></div>`).join('')}</div><div class="portal-order-meta"><p>${order.customer.delivery==='pickup'?'Pickup in Donholm':`Delivery to ${escape(order.customer.address)}`}<br/>M-Pesa · ${escape(order.customer.phone)}</p><strong>${money(order.total)}</strong></div><p class="order-payment-note">${escape(order.paymentNote||'Your payment request is being processed.')}</p>${order.receipt?`<p class="receipt-label">M-Pesa receipt: <strong>${escape(order.receipt)}</strong></p>`:''}<footer><a href="${whatsapp}?text=${encodeURIComponent(`Hi Nicoo, I have a question about order ${order.id}.`)}" target="_blank" rel="noopener noreferrer">Ask about this order ↗</a><button type="button" data-download-order="${escape(order.id)}">Download ${order.status==='paid'?'receipt':'order summary'} ↓</button></footer></article>`).join(''):'<div class="portal-empty"><span>YOUR NEXT CHAPTER IS STILL UNWRITTEN</span><h3>A good space starts with one piece.</h3><p>When you place an order, you’ll find its details and payment status here.</p><a class="button dark" href="/collection">Find your first favourite ↗</a></div>';
  }catch(error){list.textContent=errorMessage(error);}finally{button.disabled=false;}
}
document.querySelector('#refresh-orders')!.addEventListener('click',()=>void loadOrders());
list.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('[data-download-order]');
  const order=orders.find(o=>o.id===button?.dataset.downloadOrder);if(!order)return;
  const text=['NICOO FURNITURE · DONHOLM, NAIROBI',order.status==='paid'?'PAYMENT RECEIPT':'ORDER SUMMARY — NOT A PAYMENT RECEIPT',`Order: ${order.id}`,`Date: ${order.createdAt}`,`Status: ${labels[order.status]}`,'',...order.items.map((i:any)=>`${i.name} × ${i.quantity}: ${money(i.price*i.quantity)}`),'',`Furniture total: ${money(order.total)}`,`M-Pesa receipt: ${order.receipt||'Not yet confirmed'}`,`Fulfilment: ${order.customer.delivery}`,`Delivery address: ${order.customer.address||'Pickup in Donholm'}`,'Delivery fees, where applicable, are agreed separately.'].join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${order.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function addressState(){const pickup=(form.elements.namedItem('delivery') as HTMLSelectElement).value==='pickup';form.querySelector<HTMLElement>('[data-profile-address]')!.hidden=pickup;(form.elements.namedItem('address') as HTMLTextAreaElement).required=!pickup;}
form.addEventListener('change',addressState);
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector<HTMLButtonElement>('[type=submit]')!;button.disabled=true;status.textContent='Saving…';
  try{await api('/api/account/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});status.textContent='Saved. We’ll use these details at your next checkout.';}
  catch(error){status.textContent=errorMessage(error);}finally{button.disabled=false;}
});
async function init(){
  void loadOrders();
  try{const clerk=await authReady;const {profile}=await api('/api/account/profile');const values=profile||{firstName:clerk.user?.firstName||'',lastName:clerk.user?.lastName||''};for(const [key,value] of Object.entries(values)){const field=form.elements.namedItem(key);if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement)field.value=String(value);}addressState();}
  catch(error){status.textContent=errorMessage(error);}
}
void init();
