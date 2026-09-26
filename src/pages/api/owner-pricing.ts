import type {APIRoute} from 'astro';
import {createHash,timingSafeEqual} from 'node:crypto';
import {products} from '../../data/products';
import {env} from '../../server/config';
import {database} from '../../server/database';
import {body,failure,HttpError,json} from '../../server/http';

export const prerender=false;

const catalogue=products.filter(p=>p.quoteOnly&&!p.testOnly);

function authorize(request:Request){
  const expected=env('OWNER_PRICING_CODE');
  if(!expected)throw new HttpError(503,'Owner pricing access is not configured.');
  const supplied=request.headers.get('x-owner-pricing-code')||'';
  const left=createHash('sha256').update(supplied).digest();
  const right=createHash('sha256').update(expected).digest();
  if(!timingSafeEqual(left,right))throw new HttpError(401,'Incorrect access code.');
}

async function savedPrices(){
  try{
    return await database<Array<{product_id:number;price:number;updated_at:string}>>(
      'nicoo_owner_prices?select=product_id,price,updated_at&order=product_id.asc'
    );
  }catch(error){
    if(error instanceof HttpError&&error.status===503)throw new HttpError(503,'Price capture storage is not ready yet. Run supabase/owner-pricing.sql once in Supabase.');
    throw error;
  }
}

export const GET:APIRoute=async({request})=>{
  try{
    authorize(request);
    const saved=await savedPrices();
    return json({
      products:catalogue.map(p=>({
        id:p.id,name:p.name,category:p.category,image:p.image,
        views:p.images?.length||1,description:p.description||''
      })),
      saved,
    });
  }catch(error){return failure(error);}
};

export const POST:APIRoute=async({request})=>{
  try{
    authorize(request);
    const input=await body(request);
    if(!input||!Array.isArray(input.prices)||input.prices.length<1||input.prices.length>catalogue.length){
      throw new HttpError(400,'Add at least one valid price before saving.');
    }
    const seen=new Set<number>();
    const now=new Date().toISOString();
    const rows=input.prices.map((entry:any)=>{
      const id=Number(entry?.id), price=Number(entry?.price);
      const product=catalogue.find(p=>p.id===id);
      if(!product||seen.has(id)||!Number.isSafeInteger(price)||price<1||price>5000000){
        throw new HttpError(400,'One or more prices are invalid. Enter whole Kenyan-shilling amounts only.');
      }
      seen.add(id);
      return {product_id:id,product_name:product.name,price,updated_at:now};
    });
    await database('nicoo_owner_prices?on_conflict=product_id',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(rows),
    });
    const saved=await savedPrices();
    return json({saved,message:`Saved ${rows.length} price${rows.length===1?'':'s'}.`});
  }catch(error){return failure(error);}
};
