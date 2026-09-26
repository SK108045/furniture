const form=document.querySelector<HTMLFormElement>('#guest-test-form')!;
const fields=form.querySelector('fieldset')!;
const submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;
const error=document.querySelector<HTMLElement>('#guest-test-error')!;
const loading=document.querySelector<HTMLElement>('#guest-test-loading')!;
const result=document.querySelector<HTMLElement>('#guest-test-result')!;
const refresh=document.querySelector<HTMLButtonElement>('#guest-test-refresh')!;
let attempt:{key:string;phone:string;email:string;orderId?:string}|null=null;
let busy=false,polls=0,timer:ReturnType<typeof setTimeout>;
function save(){try{if(attempt)sessionStorage.setItem('nicoo-guest-test',JSON.stringify(attempt));else sessionStorage.removeItem('nicoo-guest-test');}catch{}}
async function request(path='',options:RequestInit={}){const response=await fetch(`/api/payment-test${path}`,{...options,credentials:'same-origin',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...options.headers}});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Please try again.'),{status:response.status});return data;}
function show(order:any){
 if(attempt){attempt.orderId=order.id;save();}form.hidden=true;result.hidden=false;
 result.querySelector('[data-test-title]')!.textContent=({requesting:'Sending your prompt.',pending:'Check your phone.',paid:'Payment confirmed.',failed:'The request didn’t go through.',uncertain:'Let’s check that payment.'} as Record<string,string>)[order.status]||'Your payment';
 result.querySelector('[data-test-note]')!.textContent=order.paymentNote||'Awaiting payment confirmation.';
 result.querySelector('[data-test-reference]')!.textContent=order.id;
 result.querySelector<HTMLElement>('[data-test-receipt-row]')!.hidden=!order.receipt;
 result.querySelector('[data-test-receipt]')!.textContent=order.receipt||'';
 document.querySelector<HTMLElement>('#guest-test-new')!.hidden=!['paid','failed'].includes(order.status);
 clearTimeout(timer);if(['requesting','pending','uncertain'].includes(order.status)&&polls<45)timer=setTimeout(()=>void check(),4000);
}
async function check(){if(!attempt?.orderId)return;refresh.disabled=true;polls++;try{show((await request(`?id=${encodeURIComponent(attempt.orderId)}`)).order);error.textContent='';}catch(e){error.textContent=(e as Error).message;}finally{refresh.disabled=false;}}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const values=new FormData(form);
 if(!attempt){attempt={key:crypto.randomUUID(),phone:String(values.get('phone')),email:String(values.get('email')||'')};save();}
 busy=true;fields.disabled=true;submit.setAttribute('data-busy','true');loading.hidden=false;error.textContent='';
 try{show((await request('',{method:'POST',headers:{'Idempotency-Key':attempt.key},body:JSON.stringify(attempt)})).order);}
 catch(e){if([400,401,403,429].includes((e as any).status)){attempt=null;save();}error.textContent=(e as Error).message;}
 finally{busy=false;fields.disabled=false;submit.setAttribute('data-busy','false');loading.hidden=true;}
});
refresh.addEventListener('click',()=>void check());document.querySelector('#guest-test-new')!.addEventListener('click',()=>{clearTimeout(timer);attempt=null;save();polls=0;form.hidden=false;result.hidden=true;error.textContent='';});
window.addEventListener('pagehide',()=>clearTimeout(timer));
async function init(){try{await request();fields.disabled=false;try{const saved=JSON.parse(sessionStorage.getItem('nicoo-guest-test')||'null');if(saved?.key&&saved?.phone){attempt=saved;form.querySelector<HTMLInputElement>('[name=phone]')!.value=saved.phone;form.querySelector<HTMLInputElement>('[name=email]')!.value=saved.email||'';}}catch{}if(attempt?.orderId)await check();}catch(e){error.textContent=(e as Error).message;}}
void init();
