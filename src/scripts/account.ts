import {api,authReady,appearance,errorMessage} from './client';
import {clearPurchased} from './store';
import {money,products} from '../data/products';
import {whatsapp} from '../data/contact';

const $ = <T extends HTMLElement=HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const list = $('#account-orders');
const form = $<HTMLFormElement>('#profile-form');
const profileStatus = $('#profile-status');
const dialog = $<HTMLDialogElement>('#order-editor');
const editor = $<HTMLFormElement>('#order-edit-form');
const esc = (value:unknown) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const labels:Record<string,string> = {draft:'Saved draft',cancelled:'Draft cancelled',requesting:'Sending M-Pesa prompt',pending:'Awaiting confirmation',uncertain:'Payment needs checking',failed:'Payment not completed',paid:'Payment received'};
const date = (value:string) => new Date(value).toLocaleString('en-KE',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const awaiting = (order:any) => ['requesting','pending','uncertain'].includes(order.status);
let orders:any[] = [];
let savedProfile:any = null;
let profileBaseline = '';
let profileDirty = false;
let editing:any = null;
let draftItems:{id:number;quantity:number}[] = [];
let editorDirty = false;
let editorBusy = false;
let visibleCount = 6;
let loadingOrders = false;
let polling:ReturnType<typeof setTimeout>;
let refreshes = 0;
let profileMounted = false;

function feedback(message:string,failed=false) {
  const el=$('#orders-feedback');el.textContent=message;el.classList.toggle('feedback-error',failed);
}
function replaceOrder(order:any) {
  const index=orders.findIndex(o=>o.id===order.id);
  if(index<0)orders.unshift(order);else orders[index]=order;
  renderOrders();
}
function orderCard(order:any) {
  const draft=order.status==='draft';
  const support=`${whatsapp}?text=${encodeURIComponent(`Hi Nicoo, please help me with order ${order.id}.`)}`;
  const steps=order.status==='cancelled'?['Draft saved','Draft cancelled']:draft?['Draft saved','Ready when you are']:['Order placed',labels[order.status]];
  return `<article class="portal-order" data-order="${esc(order.id)}">
    <header><div><span>${esc(date(order.createdAt))}</span><h3>${esc(order.id)}</h3></div><span class="order-status status-${esc(order.status)}">${esc(labels[order.status])}</span></header>
    <div class="order-progress">${steps.map((step:string,i:number)=>`<span class="${i===0||order.status==='paid'?'complete':''}"><i>${i===0||order.status==='paid'?'✓':'·'}</i>${esc(step)}</span>`).join('')}</div>
    <div class="portal-order-items">${order.items.map((item:any)=>`<div><img src="/images/${esc(item.image)}" alt="${esc(item.name)}" width="65" height="65"/><p><strong>${esc(item.name)}</strong><span>Qty ${item.quantity} · ${money(item.price)} each</span></p><strong>${money(item.quantity*item.price)}</strong></div>`).join('')}</div>
    <div class="portal-order-meta"><p>${order.customer.delivery==='pickup'?'Pickup in Donholm':esc(order.customer.address)}<br/>${esc(order.customer.firstName)} ${esc(order.customer.lastName)} · ${esc(order.customer.contactPhone||order.customer.phone)}</p><strong>${money(order.total)}</strong></div>
    <p class="order-payment-note">${esc(order.paymentNote || (draft?'Saved to your account. Edit your pieces and pay when you’re ready.':order.status==='cancelled'?'This draft was cancelled. No payment was requested.':'Your payment request is being processed.'))}</p>
    <details class="order-detail"><summary>Order details & activity <span>＋</span></summary><dl><div><dt>Account email</dt><dd>${esc(order.email)}</dd></div><div><dt>M-Pesa number</dt><dd>${esc(order.paymentPhone||order.customer.phone)}</dd></div><div><dt>M-Pesa receipt</dt><dd>${esc(order.receipt||'Not yet confirmed')}</dd></div><div><dt>Delivery instructions</dt><dd>${esc(order.customer.note||'None added')}</dd></div>${order.sourceOrderId?`<div><dt>Based on order</dt><dd>${esc(order.sourceOrderId)}</dd></div>`:''}</dl><ol class="order-activity">${(order.history?.length?order.history:[{at:order.createdAt,label:'Order placed'}]).map((event:any)=>`<li><span>${esc(event.label)}</span><time>${esc(date(event.at))}</time></li>`).join('')}<li><span>${esc(labels[order.status])}</span><time>${esc(date(order.updatedAt))}</time></li></ol></details>
    <div class="order-actions">${order.status!=='cancelled'?`<button type="button" data-order-action="edit">${draft?'Edit draft & pay':'Edit delivery'}</button>`:''}${['failed','paid','cancelled'].includes(order.status)?`<button type="button" data-order-action="copy">${order.status==='failed'?'Revise items & retry':'Order these again'}</button>`:''}${draft?'<button type="button" data-order-action="show-cancel" class="danger-link">Cancel draft</button>':''}<button type="button" data-order-action="reference">Copy reference</button></div>
    <div class="cancel-draft-confirm" hidden><p>Cancel this saved draft? No payment has been requested.</p><button type="button" data-order-action="cancel" class="danger-button">Yes, cancel draft</button><button type="button" data-order-action="keep">Keep draft</button></div>
    <footer><a href="${support}" target="_blank" rel="noopener noreferrer">Ask about this order ↗</a><button type="button" data-order-action="download">Download ${order.status==='paid'?'receipt':'summary'} ↓</button></footer>
  </article>`;
}
function renderOrders() {
  const expanded=new Set(Array.from(list.querySelectorAll('details[open]')).map(el=>el.closest<HTMLElement>('[data-order]')?.dataset.order));
  const query=$<HTMLInputElement>('#order-search').value.trim().toLowerCase();
  const filter=$<HTMLSelectElement>('#order-filter').value;
  const sort=$<HTMLSelectElement>('#order-sort').value;
  const selected=orders.filter(o=>(filter==='all'||(filter==='pending'?awaiting(o):o.status===filter))&&[o.id,o.receipt,...o.items.map((i:any)=>i.name)].join(' ').toLowerCase().includes(query));
  selected.sort((a,b)=>sort==='amount'?b.total-a.total:sort==='oldest'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt));
  $('#account-order-count').textContent=String(orders.filter(o=>!['draft','cancelled'].includes(o.status)).length);
  $('#account-pending-count').textContent=String(orders.filter(o=>o.status==='draft'||awaiting(o)).length);
  $('#account-spend').textContent=money(orders.filter(o=>o.status==='paid').reduce((sum,o)=>sum+o.total,0));
  $('#order-results-count').textContent=`${selected.length} ${selected.length===1?'order':'orders'}${selected.length>visibleCount?` · showing ${visibleCount}`:''}`;
  $('#show-more-orders').hidden=selected.length<=visibleCount;
  list.innerHTML=selected.length?selected.slice(0,visibleCount).map(orderCard).join(''):orders.length?'<div class="portal-empty"><h3>No orders match just yet.</h3><p>Try a different reference, product name or status.</p><button type="button" id="clear-order-filters" class="button outline-button">Clear filters</button></div>':'<div class="portal-empty"><span>ROOM FOR SOMETHING GOOD</span><h3>Your next chapter starts with one piece.</h3><p>Orders, saved drafts and payment receipts will live here.</p><a class="button dark" href="/collection">Explore furniture ↗</a></div>';
  list.querySelectorAll<HTMLDetailsElement>('details').forEach(el=>{el.open=expanded.has(el.closest<HTMLElement>('[data-order]')?.dataset.order);});
}
async function loadOrders(silent=false) {
  if(loadingOrders)return;loadingOrders=true;
  const button=$<HTMLButtonElement>('#refresh-orders');button.disabled=true;button.classList.add('is-loading');
  if(!silent)feedback('Refreshing your orders…');
  try {
    orders=(await api('/api/orders')).orders;
    try{const id=localStorage.getItem('nicoo-active-order');const paid=orders.find(o=>o.id===id&&o.status==='paid');if(paid){clearPurchased(paid.id,paid.items);localStorage.removeItem('nicoo-active-order');sessionStorage.removeItem('nicoo-checkout-attempt');}}catch{}
    renderOrders();if(!silent)feedback(`Up to date · ${new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}`);
  } catch(error) { feedback(errorMessage(error),true); if(!orders.length)list.innerHTML='<div class="portal-empty"><h3>Your orders couldn’t load.</h3><p>Use “Refresh orders” to try again.</p></div>'; }
  finally {loadingOrders=false;button.disabled=false;button.classList.remove('is-loading');scheduleRefresh();}
}
function scheduleRefresh(){clearTimeout(polling);if(orders.some(awaiting)&&refreshes<20)polling=setTimeout(()=>{if(!document.hidden&&!dialog.open&&!list.contains(document.activeElement)){refreshes++;void loadOrders(true);}else scheduleRefresh();},15000);}
function values(target:HTMLFormElement){return Object.fromEntries(new FormData(target)) as Record<string,string>;}
function fill(target:HTMLFormElement,details:Record<string,unknown>){for(const [key,value] of Object.entries(details)){const el=target.elements.namedItem(key);if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement)el.value=String(value??'');}}
function addressState(target:HTMLFormElement,selector:string){const pickup=(target.elements.namedItem('delivery') as HTMLSelectElement).value==='pickup';target.querySelector<HTMLElement>(selector)!.hidden=pickup;(target.elements.namedItem('address') as HTMLTextAreaElement).required=!pickup;}
async function showTab(id:string){
  if(!['orders','delivery-details','profile'].includes(id))return;
  document.querySelectorAll<HTMLElement>('[data-portal-panel]').forEach(el=>el.hidden=el.id!==id);
  document.querySelectorAll<HTMLAnchorElement>('[data-portal-tab]').forEach(el=>{if(el.dataset.portalTab===id)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(id==='profile'&&!profileMounted){try{const clerk=await authReady;clerk.mountUserProfile($('[data-auth-widget]'),{routing:'hash',appearance});profileMounted=true;}catch(error){$('#profile-widget-status').textContent=errorMessage(error);}}
}
function renderAddress(){
  const card=$('#saved-address');card.hidden=!savedProfile;
  if(savedProfile)card.innerHTML=`<span class="saved-label">✓ SAVED TO YOUR ACCOUNT</span><h3>${esc(savedProfile.firstName)} ${esc(savedProfile.lastName)}</h3><p>${savedProfile.delivery==='pickup'?'Pickup · Donholm showroom':esc(savedProfile.address)}</p><p>${esc(savedProfile.phone)}</p>${savedProfile.note?`<p>${esc(savedProfile.note)}</p>`:''}<small>${savedProfile.updatedAt?`Last saved ${esc(date(savedProfile.updatedAt))}`:'Ready for your next checkout'}</small><div><button type="button" data-address-edit>Edit details ↗</button><button type="button" data-address-delete>Remove saved details</button></div>`;
}
async function resetProfile(){
  const clerk=await authReady;
  form.reset();fill(form,savedProfile||{firstName:clerk.user?.firstName||'',lastName:clerk.user?.lastName||''});
  addressState(form,'[data-profile-address]');profileBaseline=JSON.stringify(values(form));profileDirty=false;$('#profile-dirty').textContent='';
  form.hidden=!!savedProfile;renderAddress();
}
async function loadProfile(){
  const fieldset=form.querySelector('fieldset')!;fieldset.disabled=true;
  $('#retry-profile').hidden=true;
  try {savedProfile=(await api('/api/account/profile')).profile;fieldset.disabled=false;await resetProfile();profileStatus.textContent=savedProfile?'Your delivery details are saved and ready to use.':'Add your details below to make your next checkout quicker.';}
  catch(error){profileStatus.textContent=errorMessage(error);$('#retry-profile').hidden=false;}
}
function editorTotal(){return draftItems.reduce((sum,item)=>sum+(products.find(p=>p.id===item.id)?.price||0)*item.quantity,0);}
function renderEditorItems(){
  $('#editor-products').innerHTML=draftItems.map(item=>{const p=products.find(p=>p.id===item.id)!;return `<div class="editor-product"><img src="/images/${p.image}" alt="${esc(p.name)}" width="60" height="60"/><div><strong>${esc(p.name)}</strong><span>${money(p.price)} each</span><button type="button" data-remove-item="${p.id}">Remove</button></div><label>Qty<input type="number" min="1" max="20" step="1" required value="${item.quantity}" data-item-quantity="${p.id}" aria-label="Quantity for ${esc(p.name)}"/></label></div>`;}).join('');
  updateEditorTotal();
}
function updateEditorTotal(){$('#editor-total').textContent=money(editorTotal());$('#editor-pay').textContent=`Save & pay ${money(editorTotal())}`;}
function openEditor(order:any){
  editing=order;editor.reset();editorDirty=false;editorBusy=false;$('#editor-discard').hidden=true;
  editor.querySelector('fieldset')!.disabled=false;$('#editor-status').textContent='';
  $('#editor-reference').textContent=order.id;
  $('#order-editor-title').textContent=order.status==='draft'?'Your draft. Your way.':'Update your delivery.';
  $('#editor-explanation').textContent=order.status==='draft'?'Change your pieces, quantities or delivery details. Save for later, or request an M-Pesa prompt below.':'Update the recipient, contact number and delivery instructions. The items and M-Pesa amount stay attached to the original payment request. If dispatch is already arranged, contact the shop too.';
  const draft=order.status==='draft';
  $('#editor-products-wrap').hidden=!draft;$('#editor-payment').hidden=!draft;$('#editor-pay').hidden=!draft;
  (editor.elements.namedItem('phone') as HTMLInputElement).required=draft;
  fill(editor,{...order.customer,contactPhone:order.customer.contactPhone||order.customer.phone,phone:order.paymentPhone||order.customer.phone});
  draftItems=order.items.map((i:any)=>({id:i.id,quantity:i.quantity}));
  if(draft)renderEditorItems();else $('#editor-products').innerHTML='';
  addressState(editor,'[data-editor-address]');dialog.showModal();document.body.style.overflow='hidden';
}
function requestClose(){if(editorBusy)return;if(editorDirty){$('#editor-discard').hidden=false;$('#editor-discard-yes').focus();}else dialog.close();}
async function patch(order:any,payload:object){return (await api(`/api/orders/${encodeURIComponent(order.id)}`,{method:'PATCH',body:JSON.stringify({version:order.version,...payload})})).order;}
function receiptHtml(order:any){
  const title=order.status==='paid'?'Payment receipt':'Order summary';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(order.id)} · ${title}</title><style>body{font:15px/1.7 Arial,sans-serif;color:#253e2c;margin:60px auto;padding:0 30px;max-width:760px}h1{font-size:38px;letter-spacing:-2px}small{color:#72776b}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{text-align:left;padding:12px 5px;border-bottom:1px solid #ddd}td:last-child,th:last-child{text-align:right}.total{font-size:24px}footer{border-top:1px solid #ccc;margin-top:35px;padding-top:20px}@media print{body{margin:20px auto}}</style><body><h1>nicoo.</h1><small>FURNITURE · DONHOLM, NAIROBI</small><h2>${title}</h2>${order.status!=='paid'?'<p>NOT A PAYMENT RECEIPT · Payment has not been confirmed.</p>':''}<p><strong>${esc(order.id)}</strong><br/>${esc(date(order.createdAt))}<br/>${esc(labels[order.status])}</p><p>${esc(order.customer.firstName)} ${esc(order.customer.lastName)}<br/>${esc(order.email)}</p><table><thead><tr><th>Furniture</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${order.items.map((i:any)=>`<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${money(i.price*i.quantity)}</td></tr>`).join('')}</tbody></table><p class="total">Furniture total: ${money(order.total)}</p><p>M-Pesa receipt: ${esc(order.receipt||'Not confirmed')}<br/>${order.customer.delivery==='pickup'?'Pickup in Donholm':`Delivery: ${esc(order.customer.address)}`}</p><footer>Delivery charges are agreed separately with the shop.<br/>Asante for making room for Nicoo.</footer></body></html>`;
}
list.addEventListener('click',async event=>{
  if((event.target as Element).closest('#clear-order-filters')){$<HTMLInputElement>('#order-search').value='';$<HTMLSelectElement>('#order-filter').value='all';renderOrders();return;}
  const button=(event.target as Element).closest<HTMLButtonElement>('[data-order-action]');
  const article=button?.closest<HTMLElement>('[data-order]');const order=orders.find(o=>o.id===article?.dataset.order);if(!button||!order)return;
  const action=button.dataset.orderAction;
  if(action==='edit'){openEditor(order);return;}
  if(action==='show-cancel'||action==='keep'){article!.querySelector<HTMLElement>('.cancel-draft-confirm')!.hidden=action==='keep';return;}
  if(action==='download'){const url=URL.createObjectURL(new Blob([receiptHtml(order)],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${order.id}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);return;}
  button.disabled=true;
  try{
    if(action==='reference'){await navigator.clipboard.writeText(order.id);feedback(`Copied ${order.id}`);}
    if(action==='copy'){const draft=await patch(order,{action:'copy'});replaceOrder(draft);feedback('A new draft is saved to your account. Review the current prices before paying.');openEditor(draft);}
    if(action==='cancel'){replaceOrder(await patch(order,{action:'cancel'}));feedback('Draft cancelled. No payment was requested.');}
  }catch(error){feedback(action==='reference'?`Copy this reference: ${order.id}`:errorMessage(error),true);}finally{button.disabled=false;}
});
editor.addEventListener('input',event=>{editorDirty=true;const el=event.target as HTMLInputElement;if(el.dataset.itemQuantity){const item=draftItems.find(i=>i.id===Number(el.dataset.itemQuantity));if(item)item.quantity=Number(el.value);updateEditorTotal();}});
editor.addEventListener('change',()=>{editorDirty=true;addressState(editor,'[data-editor-address]');});
$('#editor-products').addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-remove-item]');if(!button)return;draftItems=draftItems.filter(i=>i.id!==Number(button.dataset.removeItem));editorDirty=true;renderEditorItems();});
$('#editor-add-button').addEventListener('click',()=>{const id=Number($<HTMLSelectElement>('#editor-add-product').value);const item=draftItems.find(i=>i.id===id);if(item){if(item.quantity>=20){$('#editor-status').textContent='The maximum quantity per piece is 20.';return;}item.quantity++;}else draftItems.push({id,quantity:1});editorDirty=true;renderEditorItems();});
editor.addEventListener('submit',async event=>{
  event.preventDefault();if(editorBusy||!editing)return;
  const pay=(event.submitter as HTMLButtonElement)?.id==='editor-pay';
  if(editing.status==='draft'&&!draftItems.length){$('#editor-status').textContent='Add at least one piece to your draft.';return;}
  const customer={...editing.customer,...values(editor)};
  editorBusy=true;editor.querySelector('fieldset')!.disabled=true;$('#editor-status').textContent=pay?'Saving your draft and requesting M-Pesa…':'Saving your changes…';
  try{
    editing=await patch(editing,{action:'edit',customer,...(editing.status==='draft'?{items:draftItems}:{})});replaceOrder(editing);editorDirty=false;
    if(pay){editing=await patch(editing,{action:'pay',phone:customer.phone});replaceOrder(editing);feedback(editing.paymentNote||'Payment request saved. Check your phone, then refresh this order.');scheduleRefresh();}
    else feedback('Your order changes are saved.');
    dialog.close();
  }catch(error){$('#editor-status').textContent=errorMessage(error);}
  finally{editorBusy=false;editor.querySelector('fieldset')!.disabled=false;}
});
dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow='';});
$('[data-editor-close]').addEventListener('click',requestClose);
$('#editor-discard-yes').addEventListener('click',()=>{editorDirty=false;dialog.close();});
$('#editor-keep').addEventListener('click',()=>$('#editor-discard').hidden=true);
form.addEventListener('input',()=>{profileDirty=JSON.stringify(values(form))!==profileBaseline;$('#profile-dirty').textContent=profileDirty?'You have unsaved changes.':'';});
form.addEventListener('change',()=>addressState(form,'[data-profile-address]'));
form.addEventListener('submit',async event=>{
  event.preventDefault();const payload=values(form);const fieldset=form.querySelector('fieldset')!;fieldset.disabled=true;profileStatus.textContent='Saving your details…';
  try{savedProfile=(await api('/api/account/profile',{method:'PUT',body:JSON.stringify(payload)})).profile;fieldset.disabled=false;await resetProfile();profileStatus.textContent='Saved to your account. These details will fill in automatically at checkout.';}
  catch(error){profileStatus.textContent=errorMessage(error);}finally{fieldset.disabled=false;}
});
$('#reset-profile').addEventListener('click',()=>void resetProfile());
$('#saved-address').addEventListener('click',event=>{if((event.target as Element).closest('[data-address-edit]')){form.hidden=false;(form.elements.namedItem('firstName') as HTMLInputElement).focus();}if((event.target as Element).closest('[data-address-delete]'))$('#profile-delete-confirm').hidden=false;});
$('#keep-profile').addEventListener('click',()=>$('#profile-delete-confirm').hidden=true);
$('#confirm-delete-profile').addEventListener('click',async()=>{
  const button=$<HTMLButtonElement>('#confirm-delete-profile');button.disabled=true;
  try{await api('/api/account/profile',{method:'DELETE'});savedProfile=null;await resetProfile();$('#profile-delete-confirm').hidden=true;profileStatus.textContent='Saved details removed. Your existing orders are unchanged.';}
  catch(error){profileStatus.textContent=errorMessage(error);}finally{button.disabled=false;}
});
$('#retry-profile').addEventListener('click',()=>void loadProfile());
$('#refresh-orders').addEventListener('click',()=>void loadOrders());
for(const id of ['order-search','order-filter','order-sort'])$('#'+id).addEventListener(id==='order-search'?'input':'change',()=>{visibleCount=6;renderOrders();});
$('#show-more-orders').addEventListener('click',()=>{visibleCount+=6;renderOrders();});
document.querySelectorAll<HTMLElement>('[data-portal-tab]').forEach(tab=>tab.addEventListener('click',()=>void showTab(tab.dataset.portalTab!)));
window.addEventListener('hashchange',()=>{const tab=location.hash.slice(1);if(['orders','delivery-details','profile'].includes(tab))void showTab(tab);});
window.addEventListener('beforeunload',event=>{if(profileDirty||editorDirty||editorBusy){event.preventDefault();}});
window.addEventListener('pagehide',()=>clearTimeout(polling));
export async function initAccount(){
  const clerk=await authReady;const email=$('[data-account-email]');email.textContent=clerk.user?.primaryEmailAddress?.emailAddress||'';
  await Promise.allSettled([loadOrders(),loadProfile()]);
  await showTab(['orders','delivery-details','profile'].includes(location.hash.slice(1))?location.hash.slice(1):'orders');
}
