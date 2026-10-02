import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';

test('built Vercel handler accepts the public hostname for anonymous multipart uploads',async()=>{
  const names=['VERCEL','VERCEL_PROJECT_PRODUCTION_URL'];
  const saved=names.map(name=>process.env[name]);
  process.env.VERCEL='1';process.env.VERCEL_PROJECT_PRODUCTION_URL='furniture-chi-eight.vercel.app';
  const {default:handler}=await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
  const server=createServer((request,response)=>handler(request,response).catch(error=>{console.error(error);response.statusCode=500;response.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const local=`http://127.0.0.1:${server.address().port}`,origin='https://furniture-chi-eight.vercel.app';
  const headers={host:'furniture-chi-eight.vercel.app','x-forwarded-proto':'https',origin};
  // Node's fetch overrides Host, so send through node:http to reproduce the
  // exact incoming headers Vercel supplies to the adapter.
  async function send(path,options={}) {
    const input=new Request(local+path,options),bytes=Buffer.from(await input.arrayBuffer());
    return new Promise((resolve,reject)=>{
      const request=httpRequest(local+path,{method:input.method,headers:Object.fromEntries(input.headers)},response=>{
        const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));
      });request.on('error',reject);request.end(bytes);
    });
  }
  try {
    // Invalid upload identity stops inside our route before any database or AI
    // call. A framework-origin failure would instead return a plain-text 403.
    const form=new FormData();form.set('photo',new File(['test image'],'desk.jpg',{type:'image/jpeg'}));form.set('price','14500');form.set('uploadKey','invalid');
    for(const proxyHeaders of [headers,{...headers,host:'internal.invalid','x-forwarded-host':'furniture-chi-eight.vercel.app'}]) {
      const upload=await send('/api/admin/products',{method:'POST',headers:proxyHeaders,body:form});assert.equal(upload.status,400);assert.deepEqual(await upload.json(),{error:'A valid upload ID is required.'});
    }
    const denied=await send('/api/admin/products',{method:'POST',headers:{...headers,origin:'https://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);

  }finally {await new Promise(resolve=>server.close(resolve));names.forEach((name,index)=>{if(saved[index]===undefined)delete process.env[name];else process.env[name]=saved[index];});}
});
