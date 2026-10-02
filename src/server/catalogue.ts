import {products as originalProducts, type Product} from '../data/products';
import {database, query} from './database';

export type ProductRow = {id:number; name:string; category:string; price:number; image:string; created_at:string; upload_key:string; created_by:string};
export function uploadedProduct(row:ProductRow):Product {
  return {id:row.id,name:row.name,category:row.category,price:row.price,image:row.image,images:[row.image],
    description:'Contact the shop to confirm dimensions, finishes and availability.',tag:'New arrival',
    quoteOnly:false,testOnly:false,originalPrice:row.price,onSale:false,featuredOffer:false,savings:0,discountPercent:0};
}
export async function uploadedRows() {
  const all:ProductRow[]=[];
  for(let offset=0;;offset+=500) {
    const rows=await database<ProductRow[]>(`nicoo_products?${query({select:'id,name,category,price,image,created_at,upload_key,created_by',order:'created_at.desc,id.desc',limit:'500',offset:String(offset)})}`);
    all.push(...rows);if(rows.length<500)return all;
  }
}
export async function loadCatalogue():Promise<Product[]> {
  // The existing shop remains available before the additive migration is run.
  // Never cache database failures or products in a shared mutable module variable.
  try{return [...originalProducts,...(await uploadedRows()).map(uploadedProduct)];}
  catch {console.warn('Uploaded catalogue unavailable; serving the existing catalogue.');return [...originalProducts];}
}
export function pageCatalogue(locals:App.Locals) {
  return locals.nicooCatalogue ||= loadCatalogue();
}
