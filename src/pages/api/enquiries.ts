import type {APIRoute} from 'astro';
import {randomUUID} from 'node:crypto';
import {loadCatalogue} from '../../server/catalogue';
import {database} from '../../server/database';
import {body,failure,HttpError,json} from '../../server/http';
import {clean,phoneNumber} from '../../server/validation';

export const prerender=false;

const allowedTopics=new Set(['Planning a visit','A product question','Delivery to my area','Furnishing an office']);

export const POST:APIRoute=async({request})=>{
  try{
    const input=await body(request);
    if(!input||typeof input!=='object')throw new HttpError(400,'Please complete the enquiry form.');

    // Quietly absorb basic bot submissions.
    if(typeof input.website==='string'&&input.website.trim())return json({ok:true});

    const name=clean(input.name,'name',100);
    const phone=phoneNumber(input.phone);
    const email=clean(input.email||'','email',180,true);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Enter a valid email address.');

    const topic=clean(input.topic,'enquiry type',80);
    if(!allowedTopics.has(topic))throw new HttpError(400,'Choose a valid enquiry type.');

    const message=clean(input.message,'message',2000);
    if(message.length<10)throw new HttpError(400,'Please add a little more detail.');

    let productId:number|null=null,productName:string|null=null;
    if(input.product!==''&&input.product!==null&&input.product!==undefined){
      productId=Number(input.product);
      const product=(await loadCatalogue()).find(p=>p.id===productId&&!p.testOnly);
      if(!product)throw new HttpError(400,'Choose a valid product.');
      productName=product.name;
    }

    await database('nicoo_enquiries',{
      method:'POST',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({
        id:randomUUID(),
        name,
        phone,
        email:email||null,
        topic,
        product_id:productId,
        product_name:productName,
        message,
      }),
    });

    return json({ok:true});
  }catch(error){return failure(error);}
};
