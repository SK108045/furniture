import {animate,inView} from 'motion';
import {products,money,productImage} from './catalogue';
import {productWhatsapp} from '../data/contact';
const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Cart=Record<string,number>;
const key='nicoo-bag-v1';
let cart:Cart={};
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object')for(const p of products){const q=saved[p.id];if(!p.quoteOnly&&Number.isInteger(q)&&q>0)cart[p.id]=Math.min(q,p.testOnly?1:20);}}catch{}
const $=(s:string)=>document.querySelector<HTMLElement>(s);
let toastTimer:ReturnType<typeof setTimeout>;
function toast(message:string){const el=$('#toast')!;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
function open(id:string){const el=document.getElementById(id) as HTMLDialogElement;el.showModal();document.body.style.overflow='hidden';}
function close(id:string){(document.getElementById(id) as HTMLDialogElement).close();}
function total(){return products.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0)}
function productInquiry(p:typeof products[number]){
  const productUrl=new URL('/collection',location.origin);
  productUrl.searchParams.set('product',String(p.id));
  productUrl.searchParams.set('share','whatsapp');
  const message=[
    `Hi Nicoo, I'm interested in ${p.name} (item ${p.id}). Is it available?`,
    '',
    productUrl.toString(),
  ].join('\n');
  return `${productWhatsapp}?text=${encodeURIComponent(message)}`;
}
function render(){
 const count=Object.values(cart).reduce((a,b)=>a+b,0);document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=String(count));
 const items=products.filter(p=>cart[p.id]);
 $('#cart-items')!.innerHTML=items.length?items.map(p=>`<div class="cart-item"><img src="${esc(productImage(p.image))}" alt="${esc(p.name)}"/><div><h3>${esc(p.name)}</h3><p>${money(p.price)}</p><div class="cart-controls"><div class="quantity"><button data-qty="${p.id}" data-change="-1" aria-label="Decrease ${esc(p.name)} quantity">−</button><span>${cart[p.id]}</span><button data-qty="${p.id}" data-change="1" aria-label="Increase ${esc(p.name)} quantity" ${cart[p.id]>=(p.testOnly?1:20)?'disabled':''}>+</button></div><button class="remove" data-remove="${p.id}">Remove</button></div></div></div>`).join(''):'<div class="empty-cart"><h3>A little room for something good.</h3><p>Your bag is empty. Find a piece that feels like you.</p><a class="button dark" href="/collection">Explore the collection →</a></div>';
 $('#cart-summary')!.innerHTML=items.length?`<div class="cart-total"><span>Subtotal</span><span>${money(total())}</span></div><p>Delivery cost to be confirmed with the shop.<br/>Pay securely with M-Pesa at checkout.</p><a class="button dark" href="/checkout">Continue to checkout <span>→</span></a>`:'';
 const summary=$('#checkout-items');if(summary){summary.innerHTML=items.length?items.map(p=>`<div class="order-line"><img src="${esc(productImage(p.image))}" alt="${esc(p.name)}"/><div><h3>${esc(p.name)}</h3><p>Qty ${cart[p.id]}</p></div><span>${money(p.price*cart[p.id])}</span></div>`).join(''):'<div class="checkout-empty"><h3>Your bag is waiting.</h3><p>Add a favourite from the collection to check out.</p><a class="text-link" href="/collection">Explore the collection →</a></div>';$('#checkout-subtotal')!.textContent=money(total());$('#checkout-total')!.textContent=money(total());const submit=$('#checkout-submit') as HTMLButtonElement;if(!submit.closest('fieldset')?.disabled)submit.disabled=!items.length;}
}
function save(){try{localStorage.setItem(key,JSON.stringify(cart));}catch{toast('Your bag is available for this page only. Browser storage is unavailable.')}render();window.dispatchEvent(new Event('nicoo:cart'));}
document.addEventListener('click',event=>{const target=(event.target as Element).closest<HTMLElement>('button, [data-cart-open]');if(!target)return;
 if(target.hasAttribute('data-add')){const id=target.dataset.add!;const p=products.find(p=>String(p.id)===id);if(!p||p.quoteOnly)return;if((p.testOnly&&Object.keys(cart).some(k=>k!==id))||(!p.testOnly&&cart['9001'])){toast('Check out the KSh 1 test separately. Remove other items from the bag first.');return;}if((cart[id]||0)>=(p.testOnly?1:20)){toast(p.testOnly?'The test item is already in your bag.':'Maximum of 20 per piece per order.');return;}cart[id]=(cart[id]||0)+1;save();if((document.getElementById('product-dialog') as HTMLDialogElement).open)close('product-dialog');toast(`${p.name} added to your bag`);}
 if(target.hasAttribute('data-cart-open'))open('cart-dialog');
 if(target.dataset.close)close(target.dataset.close);
 if(target.dataset.remove){delete cart[target.dataset.remove];save();}
 if(target.dataset.qty){const id=target.dataset.qty;const maximum=products.find(p=>String(p.id)===id)?.testOnly?1:20;cart[id]=Math.max(0,Math.min(maximum,(cart[id]||0)+Number(target.dataset.change)));if(!cart[id])delete cart[id];save();}
 if(target.dataset.product){const p=products.find(p=>p.id===Number(target.dataset.product));if(!p)return;$('#product-details')!.innerHTML=`<div class="product-detail-grid"><div class="product-gallery"><img class="detail-photo" src="${esc(productImage(p.image))}" alt="${esc(p.name)}"/>${p.images.length>1?`<div class="gallery-controls"><button data-gallery-step="-1" aria-label="Previous photo">←</button><span data-gallery-status aria-live="polite">1 / ${p.images.length}</span><button data-gallery-step="1" aria-label="Next photo">→</button></div><div class="gallery-thumbs">${p.images.map((img,i)=>`<button data-gallery-index="${i}" aria-label="View photo ${i+1}" aria-pressed="${i===0}"><img src="${esc(productImage(img))}" alt=""/></button>`).join('')}</div>`:''}</div><div class="detail-copy"><p class="eyebrow">${esc(p.category.toUpperCase())}</p><h2 id="product-title">${esc(p.name)}</h2><p class="detail-price">${p.quoteOnly?'Ask for price':money(p.price)} ${p.onSale ? `<del>${money(p.originalPrice)}</del><small class="detail-offer">Save ${money(p.savings)} · ${p.discountPercent}% off</small>` : ''}</p><p class="detail-description">${esc(p.description)}</p><div class="detail-actions">${p.quoteOnly?'':`<button class="button dark" data-add="${p.id}">Add to bag <span>+</span></button>`}<a class="product-whatsapp" target="_blank" rel="noopener noreferrer" href="${productInquiry(p)}" aria-label="Ask about ${esc(p.name)} on WhatsApp" title="Ask about this product on WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 .8A15 15 0 0 0 3 23.3L.9 31l7.9-2.1A15.2 15.2 0 1 0 16 .8Zm0 27.7a12.5 12.5 0 0 1-6.4-1.8l-.5-.3-4.7 1.3 1.3-4.6-.3-.5A12.5 12.5 0 1 1 16 28.5Zm6.9-9.4c-.4-.2-2.2-1.1-2.5-1.2-.4-.1-.6-.2-.9.2-.2.4-.9 1.2-1.1 1.4-.2.3-.4.3-.8.1-1.1-.5-2-1-2.9-1.8-.7-.7-1.3-1.4-1.8-2.2-.2-.4 0-.6.1-.8l.6-.7.4-.6c.1-.3 0-.5 0-.7l-1.1-2.6c-.3-.7-.6-.6-.9-.6h-.8c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.3 2.8 4.3 6.8 6 1 .4 1.7.6 2.2.7 1 .3 1.8.3 2.5.2.8-.1 2.2-.9 2.5-1.8.3-.9.3-1.7.2-1.8-.1-.2-.3-.3-.7-.5Z"/></svg></a></div><small>Visit us in Donholm, Nairobi, to confirm dimensions, finishes and availability.</small></div></div>`;galleryProduct=p;galleryIndex=0;open('product-dialog');}
 if(target.dataset.galleryIndex!==undefined)showGallery(Number(target.dataset.galleryIndex));
 if(target.dataset.galleryStep)showGallery(galleryIndex+Number(target.dataset.galleryStep));
});
let galleryProduct:typeof products[number]|undefined;
let galleryIndex=0;
function showGallery(index:number){if(!galleryProduct)return;galleryIndex=(index+galleryProduct.images.length)%galleryProduct.images.length;const photo=document.querySelector<HTMLImageElement>('.detail-photo')!;photo.src=productImage(galleryProduct.images[galleryIndex]);photo.alt=`${galleryProduct.name}, view ${galleryIndex+1}`;const status=$('[data-gallery-status]');if(status)status.textContent=`${galleryIndex+1} / ${galleryProduct.images.length}`;document.querySelectorAll<HTMLElement>('[data-gallery-index]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.galleryIndex)===galleryIndex)));}
document.getElementById('product-dialog')?.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();showGallery(galleryIndex+(e.key==='ArrowRight'?1:-1));}});
document.querySelectorAll<HTMLDialogElement>('dialog:not(#order-editor)').forEach(dialog=>{dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow='';});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
window.addEventListener('storage',e=>{if(e.key===key){try{const next=JSON.parse(e.newValue||'{}');cart={};for(const p of products){if(!p.quoteOnly&&Number.isInteger(next?.[p.id])&&next[p.id]>0)cart[p.id]=Math.min(next[p.id],p.testOnly?1:20);}render();window.dispatchEvent(new Event('nicoo:cart'));}catch{}}});
render();
const requestedProduct=new URLSearchParams(location.search).get('product');
if(requestedProduct&&products.some(p=>String(p.id)===requestedProduct)){
  queueMicrotask(()=>document.querySelector<HTMLElement>(`[data-product="${requestedProduct}"]`)?.click());
}
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){inView('.product-card, .story-copy, .section-heading',(el)=>{animate(el,{opacity:[0,1],y:[22,0]},{duration:.55,ease:'easeOut'});});}

export function getCart(){return {...cart};}
export function clearPurchased(orderId:string,items: {id:number;quantity:number}[]){
 const marker=`nicoo-cleared-${orderId}`;
 try{if(localStorage.getItem(marker))return;localStorage.setItem(marker,'1');}catch{}
 for(const item of items){cart[item.id]=Math.max(0,(cart[item.id]||0)-item.quantity);if(!cart[item.id])delete cart[item.id];}save();
}

