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
let attempt: {key:string;payload:any;userId:string}|null=null;
let orderId='';
let poll:ReturnType<typeof setTimeout>;
let polls=0;
function delivery(){const pickup=new FormData(form).get('delivery')==='pickup';const label=document.querySelector<HTMLElement>('#address-label')!;label.hidden=pickup;label.querySelector('textarea')!.required=!pickup;document.querySelector('#delivery-title')!.textContent=pickup?'Shop pickup':'Delivery';document.querySelector('#delivery-value')!.textContent=pickup?'Free':'Arranged separately';}
form.addEventListener('change',delivery);
function updatePay(){const cart=getCart();const total=products.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0);submit.querySelector('[data-pay-label]')!.textContent=busy?'Sending payment request…':total?`Pay ${money(total)} with M-Pesa`:'Pay with M-Pesa';submit.disabled=busy||!total;}
window.addEventListener('nicoo:cart',updatePay);
function saveAttempt(){try{if(attempt)sessionStorage.setItem('nicoo-checkout-attempt',JSON.stringify(attempt));else sessionStorage.removeItem('nicoo-checkout-attempt');}catch{}}
function showOrder(order:any){
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
  polls++;
  const button=document.querySelector<HTMLButtonElement>('#check-payment')!;button.disabled=true;
  try{showOrder((await api(`/api/orders/${encodeURIComponent(orderId)}`)).order);}
  catch(e){result.querySelector('[data-payment-note]')!.textContent=errorMessage(e);}
  finally{button.disabled=false;}
}
document.querySelector('#check-payment')!.addEventListener('click',()=>void refresh());
retry.addEventListener('click',()=>{attempt=null;saveAttempt();orderId='';form.hidden=false;result.hidden=true;fields.disabled=false;updatePay();});
window.addEventListener('pagehide',()=>clearTimeout(poll));
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
  }catch(e){if([400,403,415,429,503].includes((e as any)?.status)){attempt=null;saveAttempt();}error.textContent=`${errorMessage(e)} Your bag is saved. If a prompt arrived, check your account before trying again.`;error.hidden=false;}
  finally{busy=false;fields.disabled=false;updatePay();}
});
async function init(){
  try{
    const clerk=await authReady;
    if(!clerk.isSignedIn){auth.innerHTML='<strong>Your order deserves its own home.</strong><p>Sign in or create an account to save your details, pay and follow your orders.</p><a class="button dark" href="/sign-in?next=/checkout">Sign in to checkout ↗</a> <a class="text-link" href="/sign-up?next=/checkout">Create an account</a>';return;}
    auth.textContent=`Signed in as ${clerk.user.primaryEmailAddress?.emailAddress||''}`;
    const user=clerk.user;
    (form.elements.namedItem('email') as HTMLInputElement).value=user.primaryEmailAddress?.emailAddress||'';
    (form.elements.namedItem('firstName') as HTMLInputElement).value=user.firstName||'';
    (form.elements.namedItem('lastName') as HTMLInputElement).value=user.lastName||'';
    clerk.addListener(()=>{if(!clerk.isSignedIn){fields.disabled=true;location.replace('/sign-in?next=/checkout');}});
    try{const saved=JSON.parse(sessionStorage.getItem('nicoo-checkout-attempt')||'null');if(saved?.userId===user.id&&saved.key&&saved.payload)attempt=saved;}catch{}
    try{const {profile}=await api('/api/account/profile');if(profile)for(const [key,value] of Object.entries(profile)){const el=form.elements.namedItem(key);if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)el.value=String(value);else if(el instanceof RadioNodeList)el.value=String(value);}}catch{}
    delivery();fields.disabled=false;updatePay();
    const {orders}=await api('/api/orders');
    const pending=orders.find((o:any)=>['requesting','pending','uncertain'].includes(o.status));
    if(pending)showOrder(pending);
    else if(attempt){
      for(const [key,value] of Object.entries(attempt.payload.customer||{})){const el=form.elements.namedItem(key);if(el instanceof HTMLInputElement&&el.type!=='checkbox'&&key!=='email'||el instanceof HTMLTextAreaElement)el.value=String(value);else if(el instanceof RadioNodeList)el.value=String(value);}
      delivery();
    }
  }catch(e){auth.textContent=errorMessage(e);}
}
void init();
