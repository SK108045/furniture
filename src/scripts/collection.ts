import {products} from '../data/products';
const filters=document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const grid=document.querySelector('#catalog-grid')!;
const cards=Array.from(grid.querySelectorAll<HTMLElement>('.product-card'));
const featuredOrder=new Map(cards.map((card,index)=>[card,index]));
const budget=document.querySelector<HTMLSelectElement>('#budget')!;
const search=document.querySelector<HTMLInputElement>('#catalog-search')!;
const sort=document.querySelector<HTMLSelectElement>('#sort')!;
const productFor=(card:HTMLElement)=>products.find(p=>p.id===Number(card.querySelector<HTMLElement>('[data-product]')!.dataset.product))!;
let active='All pieces';
function update(){
 let visible=0;
 cards.forEach(card=>{const show=(active==='All pieces'||card.dataset.category===active)&&(!search.value.trim()||`${productFor(card).name} ${productFor(card).category}`.toLowerCase().includes(search.value.trim().toLowerCase()))&&(budget.value==='all'||(!productFor(card).quoteOnly&&productFor(card).price<=Number(budget.value)));card.hidden=!show;if(show)visible++;});
 document.querySelector('#result-count')!.textContent=`${visible} ${visible===1?'piece':'pieces'} for your space`;
 document.querySelector<HTMLElement>('#catalog-empty')!.hidden=visible>0;
 filters.forEach(b=>{const on=b.dataset.filter===active;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
 [...cards].sort((a,b)=>{const pa=productFor(a),pb=productFor(b);if(sort.value!=='featured'&&pa.quoteOnly!==pb.quoteOnly)return pa.quoteOnly?1:-1;return sort.value==='low'?pa.price-pb.price:sort.value==='high'?pb.price-pa.price:featuredOrder.get(a)!-featuredOrder.get(b)!;}).forEach(card=>grid.append(card));
 const url=new URL(location.href);if(active==='All pieces')url.searchParams.delete('category');else url.searchParams.set('category',active);if(budget.value==='all')url.searchParams.delete('budget');else url.searchParams.set('budget',budget.value);history.replaceState(null,'',url);
}
const params=new URLSearchParams(location.search);
const requestedBudget=params.get('budget');if(requestedBudget&&Array.from(budget.options).some(o=>o.value===requestedBudget))budget.value=requestedBudget;
const query=params.get('category');if(query&&Array.from(filters).some(b=>b.dataset.filter===query))active=query;
filters.forEach(b=>b.addEventListener('click',()=>{active=b.dataset.filter!;update();}));
document.querySelectorAll<HTMLAnchorElement>('[data-category-jump]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();active=link.dataset.categoryJump!;search.value='';budget.value='all';update();document.querySelector('#all-products')!.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
search.addEventListener('input',update);budget.addEventListener('change',update);sort.addEventListener('change',update);
document.querySelector('#reset-filters')!.addEventListener('click',()=>{active='All pieces';budget.value='all';sort.value='featured';search.value='';update();filters[0].focus();});
update();
