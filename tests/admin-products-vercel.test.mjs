import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';

test('built Vercel handler accepts the public hostname for login, multipart uploads and logout',async()=>{
  const names=['VERCEL','VERCEL_PROJECT_PRODUCTION_URL','ADMIN_UPLOAD_PASSWORD'];
  const saved=names.map(name=>process.env[name]);
  process.env.VERCEL='1';process.env.VERCEL_PROJECT_PRODUCTION_URL='furniture-chi-eight.vercel.app';process.env.ADMIN_UPLOAD_PASSWORD='test-upload-password';
  const {default:handler}=await import('../dist/server/entry.mjs');
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
    const response=await send('/api/admin/session',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'test-upload-password'})});
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{authenticated:true});assert.match(response.headers.get('Set-Cookie'),/; Secure$/);
    const cookie=response.headers.get('Set-Cookie').split(';')[0];
    const checked=await send('/api/admin/session',{headers:{...headers,cookie}});assert.deepEqual(await checked.json(),{authenticated:true});
    // Invalid upload identity stops inside our route before any database or AI
    // call. A framework-origin failure would instead return a plain-text 403.
    const form=new FormData();form.set('photo',new File(['test image'],'desk.jpg',{type:'image/jpeg'}));form.set('price','14500');form.set('uploadKey','invalid');
    for(const proxyHeaders of [headers,{...headers,host:'internal.invalid','x-forwarded-host':'furniture-chi-eight.vercel.app'}]) {
      const upload=await send('/api/admin/products',{method:'POST',headers:{...proxyHeaders,cookie},body:form});assert.equal(upload.status,400);assert.deepEqual(await upload.json(),{error:'A valid upload ID is required.'});
    }
    const denied=await send('/api/admin/session',{method:'POST',headers:{...headers,origin:'https://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
    const ended=await send('/api/admin/session',{method:'DELETE',headers:{...headers,cookie}});assert.equal(ended.status,200);assert.deepEqual(await ended.json(),{authenticated:false});assert.match(ended.headers.get('Set-Cookie'),/Max-Age=0; Secure$/);
  }finally {await new Promise(resolve=>server.close(resolve));names.forEach((name,index)=>{if(saved[index]===undefined)delete process.env[name];else process.env[name]=saved[index];});}
});
