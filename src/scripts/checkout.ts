import {api,authReady,errorMessage} from './client';
import {getCart,clearPurchased} from './store';
import {money,products} from '../data/products';
import {whatsapp} from '../data/contact';
const form=document.querySelector<HTMLFormElement>('#checkout-form')!;
const fields=document.querySelector<HTMLFieldSetElement>('#checkout-fields')!;
const auth=document.querySelector<HTMLElement>('#checkout-auth')!;
const submit=document.querySelector<HTMLButtonElement>('#checkout-submit')!;
const error=document.querySelector<HTMLElement>('#checkout-error')!;
const result=document.querySelector<HTMLElement>('#payment-result')!;
const retry=document.querySelector<HTMLButtonElement>('#retry-payment')!;
let busy=false;
let attempt: {key:string;payload:any;userId:string;orderId?:string}|null=null;
let orderId='';
let poll:ReturnType<typeof setTimeout>;
let polls=0;
let activeOrder:any=null;
function currentItems(){return Object.entries(getCart()).map(([id,quantity])=>({id:Number(id),quantity}));}
function sameItems(items:any){
  if(!Array.isArray(items))return false;
  const cart=currentItems();
  return items.length===cart.length&&items.every((item:any)=>cart.some(line=>line.id===item.id&&line.quantity===item.quantity));
}
function currentTotal(){return products.reduce((sum,p)=>sum+p.price*(getCart()[p.id]||0),0);}
function earlierPayment(message?:string){
  const notice=document.querySelector<HTMLElement>('#previous-payment-notice')!;notice.hidden=false;
  if(message)notice.querySelector('[data-previous-payment-message]')!.textContent=message;
}
function returnToBag(){clearTimeout(poll);orderId='';activeOrder=null;attempt=null;saveAttempt();polls=0;form.hidden=false;result.hidden=true;updatePay();}
function delivery(){const pickup=new FormData(form).get('delivery')==='pickup';const label=document.querySelector<HTMLElement>('#address-label')!;label.hidden=pickup;label.querySelector('textarea')!.required=!pickup;document.querySelector('#delivery-title')!.textContent=pickup?'Shop pickup':'Delivery';document.querySelector('#delivery-value')!.textContent=pickup?'Free':'Arranged separately';}
form.addEventListener('change',delivery);
function updatePay(){const cart=getCart();const total=products.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0);submit.querySelector('[data-pay-label]')!.textContent=busy?'Connecting securely…':total?`Pay ${money(total)} with M-Pesa`:'Pay with M-Pesa';submit.disabled=busy||!total;submit.setAttribute('data-busy',String(busy));form.setAttribute('aria-busy',String(busy));document.querySelector<HTMLElement>('#checkout-processing')!.hidden=!busy;}
window.addEventListener('nicoo:cart',()=>{
  if(!busy&&activeOrder&&activeOrder.status!=='paid'&&(!sameItems(activeOrder.items)||activeOrder.total!==currentTotal())){
    earlierPayment('Your earlier payment is saved in your account. Checkout below is for the items currently in your bag.');returnToBag();
  }
  if(!busy&&attempt&&!sameItems(attempt.payload?.items)){attempt=null;saveAttempt();}
  updatePay();
});
function saveAttempt(){try{if(attempt)sessionStorage.setItem('nicoo-checkout-attempt',JSON.stringify(attempt));else sessionStorage.removeItem('nicoo-checkout-attempt');}catch{}}
function showOrder(order:any){
  activeOrder=order;
  if(order.status!=='paid'&&(!sameItems(order.items)||order.total!==currentTotal())){
    earlierPayment(`Order ${order.id} for ${money(order.total)} is saved in your account. You can pay for your current bag below.`);returnToBag();return;
  }
  if(attempt){attempt.orderId=order.id;saveAttempt();}
  orderId=order.id;form.hidden=true;result.hidden=false;
  try{if(order.status!=='failed'&&order.status!=='paid')localStorage.setItem('nicoo-active-order',order.id);}catch{}
  const titles:Record<string,string>={requesting:'Your request is being sent.',pending:'Check your phone.',uncertain:'Let’s check that payment.',failed:'The request didn’t go through.',paid:'Asante. Payment received!'};
  result.querySelector('[data-payment-title]')!.textContent=titles[order.status]||'Your order';
  result.querySelector('[data-payment-note]')!.textContent=order.paymentNote||'Your order is saved. Please check your phone and refresh the status shortly.';
  result.querySelector('[data-payment-reference]')!.textContent=order.id;
  result.querySelector('[data-payment-amount]')!.textContent=money(order.total);
  const receiptRow=result.querySelector<HTMLElement>('[data-receipt-row]')!;receiptRow.hidden=!order.receipt;
  result.querySelector('[data-payment-receipt]')!.textContent=order.receipt||'';
  (document.querySelector('#payment-help') as HTMLAnchorElement).href=`${whatsapp}?text=${encodeURIComponent(`Hi Nicoo, please help me confirm payment for order ${order.id}.`)}`;
  retry.hidden=order.status!=='failed';
  if(order.status==='paid'){clearPurchased(order.id,order.items);try{localStorage.removeItem('nicoo-active-order');}catch{}attempt=null;saveAttempt();}
  clearTimeout(poll);
  if(['pending','requesting','uncertain'].includes(order.status)&&polls<30)poll=setTimeout(()=>void refresh(),10000);
}
async function refresh(){
  if(!orderId)return;
  const requestedId=orderId;
  polls++;
  const button=document.querySelector<HTMLButtonElement>('#check-payment')!;button.disabled=true;
  try{const data=await api(`/api/orders/${encodeURIComponent(requestedId)}`);if(orderId===requestedId)showOrder(data.order);}
  catch(e){result.querySelector('[data-payment-note]')!.textContent=errorMessage(e);}
  finally{button.disabled=false;}
}
document.querySelector('#check-payment')!.addEventListener('click',()=>void refresh());
retry.addEventListener('click',()=>{returnToBag();fields.disabled=false;updatePay();});
window.addEventListener('pagehide',()=>clearTimeout(poll));
let draftAttempt: {key:string;payload:any}|null=null;
document.querySelector('#checkout-save-draft')!.addEventListener('click',async()=>{
  if(busy)return;
  const consent=form.elements.namedItem('confirm') as HTMLInputElement;
  consent.required=false;const valid=form.reportValidity();consent.required=true;if(!valid)return;
  if(attempt){error.textContent='A payment attempt is already saved. Review your account before creating a draft.';error.hidden=false;return;}
  const payload={action:'draft',items:Object.entries(getCart()).map(([id,quantity])=>({id:Number(id),quantity})),customer:Object.fromEntries(new FormData(form))};
  if(!draftAttempt||JSON.stringify(draftAttempt.payload)!==JSON.stringify(payload))draftAttempt={key:crypto.randomUUID(),payload};
  busy=true;fields.disabled=true;error.hidden=true;updatePay();
  try{
    await api('/api/orders',{method:'POST',headers:{'Idempotency-Key':draftAttempt.key},body:JSON.stringify(draftAttempt.payload)});
    location.assign('/account#orders');
  }catch(e){error.textContent=errorMessage(e);error.hidden=false;}
  finally{busy=false;fields.disabled=false;updatePay();}
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  error.hidden=true;
  const clerk=await authReady;
  if(!clerk.isSignedIn){location.assign('/sign-in?next=/checkout');return;}
  if(!attempt){
    const values=Object.fromEntries(new FormData(form));
    const phone=String(values.phone).replace(/[\s()-]/g,'');
    if(!/^(?:\+?254|0)[17]\d{8}$/.test(phone)){error.textContent='Enter a Kenyan mobile number, for example 0712345678.';error.hidden=false;return;}
    attempt={key:crypto.randomUUID(),userId:clerk.user.id,payload:{items:Object.entries(getCart()).map(([id,quantity])=>({id:Number(id),quantity})),customer:values}};
    saveAttempt();
  }
  busy=true;fields.disabled=true;updatePay();
  try{
    const {order}=await api('/api/orders',{method:'POST',headers:{'Idempotency-Key':attempt.key},body:JSON.stringify(attempt.payload)});
    showOrder(order);result.focus();
  }catch(e){if([400,403,415,429].includes((e as any)?.status)){attempt=null;saveAttempt();}error.textContent=`${errorMessage(e)} Your bag is saved. If a prompt arrived, check your account before trying again.`;error.hidden=false;}
  finally{busy=false;fields.disabled=false;updatePay();}
});
async function init(){
  if(currentItems().length===1&&currentItems()[0].id===9001){location.replace('/payment-test');return;}
  try{
    const clerk=await authReady;
    if(!clerk.isSignedIn){auth.innerHTML='<strong>Your order deserves its own home.</strong><p>Sign in or create an account to save your details, pay and follow your orders.</p><a class="button dark" href="/sign-in?next=/checkout">Sign in to checkout ↗</a> <a class="text-link" href="/sign-up?next=/checkout">Create an account</a>';return;}
    auth.textContent=`Signed in as ${clerk.user.primaryEmailAddress?.emailAddress||''}`;
    const user=clerk.user;
    (form.elements.namedItem('email') as HTMLInputElement).value=user.primaryEmailAddress?.emailAddress||'';
    (form.elements.namedItem('firstName') as HTMLInputElement).value=user.firstName||'';
    (form.elements.namedItem('lastName') as HTMLInputElement).value=user.lastName||'';
    clerk.addListener(()=>{if(!clerk.isSignedIn){fields.disabled=true;location.replace('/sign-in?next=/checkout');}});
    try{const saved=JSON.parse(sessionStorage.getItem('nicoo-checkout-attempt')||'null');if(saved?.userId===user.id&&saved.key&&sameItems(saved.payload?.items))attempt=saved;else sessionStorage.removeItem('nicoo-checkout-attempt');}catch{}
    try{const {profile}=await api('/api/account/profile');if(profile)for(const [key,value] of Object.entries(profile)){const el=form.elements.namedItem(key);if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)el.value=String(value);else if(el instanceof RadioNodeList)el.value=String(value);}}catch{}
    delivery();fields.disabled=false;updatePay();
    const {orders}=await api('/api/orders');
    const pending=orders.filter((o:any)=>['requesting','pending','uncertain'].includes(o.status));
    const current=attempt?.orderId?orders.find((o:any)=>o.id===attempt!.orderId):null;
    if(pending.some((o:any)=>o.id!==current?.id))earlierPayment();
    if(current&&sameItems(current.items)&&current.total===currentTotal())showOrder(current);
    else if(attempt?.orderId){attempt=null;saveAttempt();}
    if(attempt&&result.hidden){
      for(const [key,value] of Object.entries(attempt.payload.customer||{})){const el=form.elements.namedItem(key);if(el instanceof HTMLInputElement&&el.type!=='checkbox'&&key!=='email'||el instanceof HTMLTextAreaElement)el.value=String(value);else if(el instanceof RadioNodeList)el.value=String(value);}
      delivery();
    }
  }catch(e){auth.textContent=errorMessage(e);}
}
void init();
