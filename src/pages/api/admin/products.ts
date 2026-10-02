import type {APIRoute} from 'astro';
import {sameOrigin} from '../../../server/admin';
import {uploadedRows, uploadedProduct} from '../../../server/catalogue';
import {failure,json,HttpError} from '../../../server/http';
import {publishProduct,uploadForm} from '../../../server/product-upload';
export const prerender=false;
export const GET:APIRoute=async()=>{
  try {
    try{return json({products:(await uploadedRows()).map(uploadedProduct)});}
    catch {throw new HttpError(503,'The upload catalogue is not ready. Run supabase/admin-products.sql in the Supabase SQL Editor.');}
  }catch(error){return failure(error);}
};
export const POST:APIRoute=async({request})=>{
  try {
    sameOrigin(request);
    const {file,key,fields}=await uploadForm(request);
    const result=await publishProduct('shop_admin',key,file,fields);
    return json(result,result.replayed?200:201);
  }catch(error){return failure(error);}
};
