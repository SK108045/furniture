import {animate,inView,stagger} from 'motion';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const toggle=document.querySelector<HTMLButtonElement>('#motion-toggle');
let paused=reduced.matches;
function motionState(){document.documentElement.classList.toggle('motion-paused',paused);if(toggle){toggle.textContent=paused?'Play motion ▷':'Pause motion Ⅱ';toggle.setAttribute('aria-pressed',String(paused));}}
motionState();
toggle?.addEventListener('click',()=>{paused=!paused;motionState();});
reduced.addEventListener('change',()=>{paused=reduced.matches;motionState();});
if(!reduced.matches){animate('[data-hero-reveal]',{opacity:[0,1],y:[30,0]},{duration:.85,delay:stagger(.12),ease:'easeOut'});inView('[data-reveal]',el=>{animate(el,{opacity:[0,1],y:[28,0]},{duration:.7,ease:'easeOut'});});}
const tabs=document.querySelectorAll<HTMLButtonElement>('[data-pick]');
tabs.forEach(tab=>tab.addEventListener('click',()=>{tabs.forEach(t=>{const selected=t===tab;t.classList.toggle('selected',selected);t.setAttribute('aria-pressed',String(selected));});document.querySelectorAll<HTMLElement>('#home-products .product-card').forEach(card=>{card.hidden=tab.dataset.pick!=='all'&&card.dataset.category!==tab.dataset.pick;});}));
const hero=document.querySelector<HTMLElement>('.cinema-hero');
if(hero&&matchMedia('(pointer:fine)').matches){
 let frame=0;
 hero.addEventListener('pointermove',event=>{
  if(paused||reduced.matches)return;
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{const rect=hero.getBoundingClientRect();hero.style.setProperty('--hero-x',`${(event.clientX-rect.left-rect.width/2)*.025}px`);hero.style.setProperty('--hero-y',`${(event.clientY-rect.top-rect.height/2)*.025}px`);});
 });
 hero.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);hero.style.setProperty('--hero-x','0px');hero.style.setProperty('--hero-y','0px');});
}
