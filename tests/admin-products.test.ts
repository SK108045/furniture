import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {sameOrigin} from '../src/server/admin';
import {GET,POST} from '../src/pages/api/admin/products';
import {listingFields,modelListing,photoBytes,identifyProduct,publishProduct,uploadForm} from '../src/server/product-upload';
import {loadCatalogue,uploadedProduct} from '../src/server/catalogue';
import {products,productImage} from '../src/data/products';
import {orderInput} from '../src/server/validation';

const row={id:10000,name:'Grey office desk',category:'Desks',price:14500,image:'https://example.supabase.co/storage/v1/object/public/nicoo-products/user_admin/photo.jpg',created_at:'2026-10-02T12:00:00Z',created_by:'user_admin',upload_key:'12345678-1234-4123-8123-123456789abc'};
const key=row.upload_key;
const customer={firstName:'Test',lastName:'Customer',phone:'0712345678',delivery:'pickup',note:''};
async function photo() {return new File([new Uint8Array(await sharp({create:{width:32,height:32,channels:3,background:'#ddd'}}).jpeg().toBuffer())],'desk.jpg',{type:'image/jpeg'});}
const json=(data:any,status=200)=>Response.json(data,{status});
async function mocked(fn:(url:string,options?:RequestInit)=>Promise<Response>,run:()=>Promise<void>) {
  const previous=globalThis.fetch;const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','GEMINI_API_KEY'];const saved=names.map(n=>process.env[n]);
  process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='eyJtest';process.env.SUPABASE_SECRET_KEY='';process.env.GEMINI_API_KEY='test-key';
  globalThis.fetch=((url:any,options?:RequestInit)=>fn(String(url),options)) as typeof fetch;
  try {await run();}finally {globalThis.fetch=previous;names.forEach((n,i)=>{if(saved[i]===undefined)delete process.env[n];else process.env[n]=saved[i];});}
}
test('anonymous visitors can read uploads and publish furniture without a session',async()=>{
  let committed=false;
  await mocked(async(url,options)=>{
    if(url.includes('generativelanguage'))return json({},503);
    if(url.includes('/storage/v1/'))return json({});
    if(options?.method==='POST'){committed=true;return json([{...row,...JSON.parse(options.body as string)}]);}
    return json(url.includes('upload_key=')?[]:[row]);
  },async()=>{
    const listed=await GET({request:new Request('https://shop.example/api/admin/products')} as any);assert.equal(listed.status,200);
    assert.equal((await listed.json()).products[0].id,10000);
    const form=new FormData();form.set('photo',await photo());form.set('uploadKey',key);form.set('price','14500');form.set('name',row.name);form.set('category',row.category);
    const published=await POST({request:new Request('https://shop.example/api/admin/products',{method:'POST',headers:{origin:'https://shop.example'},body:form})} as any);
    assert.equal(published.status,201);assert.equal(committed,true);assert.equal((await published.json()).product.price,14500);
    const denied=await POST({request:new Request('https://shop.example/api/admin/products',{method:'POST',headers:{origin:'https://other.example'}})} as any);assert.equal(denied.status,403);
  });
});
test('website origin validation supports Vercel public URLs without a session',()=>{
  const names=['VERCEL','VERCEL_PROJECT_PRODUCTION_URL','APP_ORIGIN'];const saved=names.map(name=>process.env[name]);
  process.env.VERCEL='1';process.env.VERCEL_PROJECT_PRODUCTION_URL='furniture-chi-eight.vercel.app';process.env.APP_ORIGIN='http://localhost:4321';
  try {
    const origin='https://furniture-chi-eight.vercel.app';
    assert.doesNotThrow(()=>sameOrigin(new Request('http://localhost/api/admin/products',{method:'POST',headers:{origin}})));
    assert.throws(()=>sameOrigin(new Request('http://localhost/api/admin/products',{method:'POST',headers:{origin:'https://other.example'}})));
  }finally {names.forEach((name,index)=>{if(saved[index]===undefined)delete process.env[name];else process.env[name]=saved[index];});}
});
test('prices remain exact whole shillings and metadata is bounded',()=>{
  assert.deepEqual(listingFields('14500','',''),{price:14500,name:'',category:''});
  for(const price of ['','0','-1','12.5','150001','NaN'])assert.throws(()=>listingFields(price,'Desk','Desks'));
  assert.throws(()=>listingFields('1000','x'.repeat(101),'Desks'));
  assert.throws(()=>modelListing({name:'<script>oops</script>',category:'Desks'}));
  assert.throws(()=>modelListing({name:'Desk',category:'Made up category'}));
});
test('photo bytes are decoded and sanitised; malformed and disguised images are refused',async()=>{
  const bytes=await photoBytes(await photo());const meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.ok(meta.width!<=1600);
  await assert.rejects(photoBytes(new File(['not a photo'],'x.jpg',{type:'image/jpeg'})));
  await assert.rejects(photoBytes(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})));
  await assert.rejects(photoBytes(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'],'x.png',{type:'image/png'})));
});
test('multipart form validates upload identity and rejects oversized chunked bodies',async()=>{
  const data=new FormData();data.append('photo',await photo());data.append('price','14500');data.append('name','');data.append('category','');data.append('uploadKey',key);
  const parsed=await uploadForm(new Request('http://localhost:4321/api/admin/products',{method:'POST',body:data}));assert.equal(parsed.key,key);assert.equal(parsed.fields.price,14500);
  data.set('uploadKey','not-a-uuid');await assert.rejects(uploadForm(new Request('http://localhost:4321/api/admin/products',{method:'POST',body:data})));
  await assert.rejects(uploadForm(new Request('http://localhost:4321/api/admin/products',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test'},body:new Uint8Array(3_040_000)})));
});
test('Gemini fills/corrects metadata using the photo; cannot alter the admin price',async()=>{
  await mocked(async(url,options)=>{
    assert.match(url,/gemini-3\.1-flash-lite:generateContent$/);
    const body=JSON.parse(options!.body as string);assert.ok(body.contents[0].parts[1].inlineData.data);
    return json({candidates:[{content:{parts:[{text:JSON.stringify({name:row.name,category:'Desks',price:1})}]}}]});
  },async()=>{
    const identified=await identifyProduct(await photoBytes(await photo()),'chair','Seating');
    assert.deepEqual(identified,{name:row.name,category:'Desks',assisted:true});
  });
});
test('AI outage permits complete manual metadata, while incomplete uploads stay unpublished',async()=>{
  await mocked(async()=>json({},503),async()=>{
    assert.deepEqual(await identifyProduct(Buffer.from('test'),'Grey desk','Desks'),{name:'Grey desk',category:'Desks',assisted:false});
    await assert.rejects(identifyProduct(Buffer.from('test'),'',''),/temporarily unavailable/);
  });
});
test('publishing uploads the photo and persists exact price; retry does not duplicate',async()=>{
  let saved=false,writes=0,storageWrites=0;
  await mocked(async(url,options)=>{
    if(url.includes('generativelanguage'))return json({candidates:[{content:{parts:[{text:JSON.stringify({name:row.name,category:row.category})}]}}]});
    if(url.includes('/storage/v1/object/')){storageWrites++;assert.equal(options?.method,'POST');return json({Key:'uploaded'});}
    if(options?.method==='POST') {writes++;saved=true;const payload=JSON.parse(options.body as string);assert.equal(payload.price,14500);return json([{...row,...payload}]);}
    return json(saved?[row]:[]);
  },async()=>{
    const result=await publishProduct('user_admin',key,await photo(),listingFields('14500','',''));
    assert.equal(result.product.price,14500);assert.equal(result.product.onSale,false);assert.equal(result.product.id,10000);
    const replay=await publishProduct('user_admin',key,await photo(),listingFields('14500','',''));
    assert.equal(replay.replayed,true);assert.equal(writes,1);assert.equal(storageWrites,1);
  });
});
test('failed database insert removes an unreferenced photo',async()=>{
  let deleted=false;
  await mocked(async(url,options)=>{
    if(url.includes('generativelanguage'))return json({},503);
    if(url.includes('/storage/v1/')){if(options?.method==='DELETE')deleted=true;return json({});}
    if(options?.method==='POST')return json({code:'database-unavailable'},503);
    return json([]);
  },async()=>{await assert.rejects(publishProduct('user_admin',key,await photo(),listingFields('14500','Grey desk','Desks')));assert.equal(deleted,true);});
});
test('lost insert response preserves the image and returns the committed product',async()=>{
  let saved=false,deleted=false,committed=row;
  await mocked(async(url,options)=>{
    if(url.includes('generativelanguage'))return json({},503);
    if(url.includes('/storage/v1/')){if(options?.method==='DELETE')deleted=true;return json({});}
    if(options?.method==='POST'){saved=true;committed={...row,...JSON.parse(options.body as string)};throw new Error('Connection lost');}
    return json(saved?[committed]:[]);
  },async()=>{const result=await publishProduct('user_admin',key,await photo(),listingFields('14500','Grey desk','Desks'));assert.equal(result.replayed,true);assert.equal(deleted,false);});
});
test('live catalogue appends uploaded products and checkout uses server prices',async()=>{
  await mocked(async()=>json([row]),async()=>{
    const live=await loadCatalogue();assert.deepEqual(live.slice(0,products.length),products);assert.equal(live.at(-1)!.id,10000);
    const order=await orderInput({items:[{id:10000,quantity:2,price:1}],customer});assert.equal(order.total,29000);assert.equal(order.items[0].image,row.image);
    await assert.rejects(orderInput({items:[{id:10000,quantity:2},{id:10000,quantity:1}],customer}));
    assert.equal(productImage(row.image),row.image);assert.equal(productImage('1.jpg'),'/images/1.jpg');
    assert.equal(uploadedProduct(row).originalPrice,14500);
  });
});
test('unavailable new table preserves existing shop and KSh 1 payment validation',async()=>{
  await mocked(async()=>json({code:'PGRST205'},404),async()=>{
    assert.deepEqual(await loadCatalogue(),products);
    const order=await orderInput({items:[{id:9001,quantity:1}],customer});assert.equal(order.total,1);
  });
});
