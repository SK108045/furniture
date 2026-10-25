import type { APIRoute } from 'astro';
import sharp from 'sharp';
import {loadCatalogue} from '../../../server/catalogue';
import {productImage} from '../../../data/products';
import {env} from '../../../server/config';

export const GET: APIRoute = async ({params, request}) => {
  const id=Number(params.id);
  if(!Number.isInteger(id))return new Response('Not found',{status:404});

  const product=(await loadCatalogue()).find(p=>p.id===id);
  if(!product)return new Response('Not found',{status:404});

  const source=new URL(productImage(product.image),request.url);
  const requestOrigin=new URL(request.url).origin;
  const storageOrigin=new URL(env('SUPABASE_URL')).origin;
  if(source.origin!==requestOrigin&&source.origin!==storageOrigin)return new Response('Invalid image source',{status:400});

  let response:Response;
  try {
    response=await fetch(source,{signal:AbortSignal.timeout(12000),redirect:'error'});
  } catch {
    return new Response('Image unavailable',{status:502});
  }
  if(!response.ok)return new Response('Image unavailable',{status:502});

  try {
    const input=Buffer.from(await response.arrayBuffer());
    const image=await sharp(input,{limitInputPixels:32_000_000,failOn:'warning'})
      .rotate()
      .resize({width:1200,height:630,fit:'cover',position:'attention'})
      .jpeg({quality:72,chromaSubsampling:'4:2:0'})
      .toBuffer();

    return new Response(new Uint8Array(image),{
      headers:{
        'Content-Type':'image/jpeg',
        'Content-Length':String(image.byteLength),
        'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new Response('Image unavailable',{status:502});
  }
};
