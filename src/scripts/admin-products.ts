const errorMessage=(error:any)=>error?.message||'Please try again.';
import {money,productImage,type Product} from '../data/products';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const form=$<HTMLFormElement>('admin-product-form');
const fields=$<HTMLFieldSetElement>('admin-fields');
const input=$<HTMLInputElement>('admin-photo');
const preview=$<HTMLImageElement>('admin-photo-preview');
const status=$<HTMLDivElement>('admin-upload-status');
const button=$<HTMLButtonElement>('admin-publish');
let photo:File|undefined,photoUrl='',uploadKey=crypto.randomUUID(),busy=false,photoVersion=0;
let published:Product[]=[];
const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function message(text:string,state:'error'|'success'|'working') {
  status.hidden=false;status.dataset.state=state;status.textContent=text;
}
function setBusy(active:boolean) {
  busy=active;fields.disabled=active;form.setAttribute('aria-busy',String(active));button.dataset.busy=String(active);
  button.querySelector('[data-publish-label]')!.textContent=active?'Checking photo & publishing…':'Publish to the shop';
}
function renderPublished() {
  $('admin-published').hidden=!published.length;
  $('admin-published-list').innerHTML=published.slice(0,12).map(p=>`<a href="/collection?product=${p.id}#all-products" class="admin-published-item"><img src="${esc(productImage(p.image))}" alt="${esc(p.name)}" width="96" height="96"/><div><span>${esc(p.category)}</span><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong></div><span aria-hidden="true">↗</span></a>`).join('');
}
async function preparePhoto(file:File):Promise<File> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP photo.');
  if(!file.size||file.size>20_000_000)throw new Error('Choose a photo smaller than 20 MB.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    const ratio=Math.min(1,1600/image.naturalWidth,1600/image.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare this photo.');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This photo could not be prepared.')),'image/jpeg',0.85));
    if(blob.size>3_000_000)throw new Error('Please choose a smaller photo.');
    return new File([blob],'furniture.jpg',{type:'image/jpeg'});
  }finally {URL.revokeObjectURL(url);}
}
input.addEventListener('change',async()=>{
  const version=++photoVersion;photo=undefined;if(photoUrl)URL.revokeObjectURL(photoUrl);preview.hidden=true;preview.removeAttribute('src');$('admin-photo-empty').hidden=false;
  const file=input.files?.[0];if(!file){button.disabled=false;status.hidden=true;return;}
  button.disabled=true;message('Preparing your photograph…','working');
  try {
    const prepared=await preparePhoto(file);if(version!==photoVersion)return;
    photo=prepared;photoUrl=URL.createObjectURL(photo);preview.src=photoUrl;preview.hidden=false;$('admin-photo-empty').hidden=true;status.hidden=true;uploadKey=crypto.randomUUID();
  }catch(error){if(version===photoVersion){input.value='';message(errorMessage(error),'error');}}
  finally {if(version===photoVersion)button.disabled=false;}
});
form.addEventListener('input',event=>{if(event.target!==input&&!busy)uploadKey=crypto.randomUUID();});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(!photo){message('Choose a furniture photo first.','error');input.focus();return;}
  const data=new FormData();data.append('photo',photo);data.append('uploadKey',uploadKey);
  data.append('price',$<HTMLInputElement>('admin-price').value);data.append('name',$<HTMLInputElement>('admin-name').value);data.append('category',$<HTMLSelectElement>('admin-category').value);
  setBusy(true);message('Checking the name and category, then adding your piece to the shop…','working');
  try {
    const response=await fetch('/api/admin/products',{method:'POST',credentials:'same-origin',body:data,signal:AbortSignal.timeout(60000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'The upload could not be completed.');
    const product=result.product as Product;
    published=[product,...published.filter(p=>p.id!==product.id)];renderPublished();
    message(`Published: ${product.name} · ${product.category} · ${money(product.price)}. It’s now in the shop.${result.assisted?'':result.replayed?'':' The photo assistant was unavailable, so your name and category were used.'}`,'success');
    form.reset();photo=undefined;uploadKey=crypto.randomUUID();if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';preview.hidden=true;preview.removeAttribute('src');$('admin-photo-empty').hidden=false;status.focus();
  }catch(error){message(`${errorMessage(error)} Your details are still here; retry to check the same upload.`,'error');status.focus();}
  finally {setBusy(false);}
});
async function loadPublished() {
  try {
    const response=await fetch('/api/admin/products',{signal:AbortSignal.timeout(60000)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'The latest uploads could not be loaded.');
    published=result.products;renderPublished();
  }catch(error){message(errorMessage(error),'error');}
}
void loadPublished();
