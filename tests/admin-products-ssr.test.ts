import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';

test('server-rendered catalogue, checkout and admin routes work with uploaded furniture',async()=>{
  const row={id:10000,name:'Grey desk </script><script>unsafe()</script>',category:'Desks',price:14500,image:'https://example.supabase.co/storage/v1/object/public/nicoo-products/desk.jpg',created_at:'2026-10-02T12:00:00Z',created_by:'user_admin',upload_key:'12345678-1234-4123-8123-123456789abc'};
  const db=createServer((request,response)=>{assert.equal(request.method,'GET');response.setHeader('Content-Type','application/json');response.end(JSON.stringify([row]));});
  await new Promise<void>(resolve=>db.listen(0,'127.0.0.1',resolve));
  const dbPort=(db.address() as any).port;
  // Start the dev server in the same network namespace as this test. All
  // database reads go to a local fixture; nothing is written to production.
  const server=spawn(process.execPath,['node_modules/astro/astro.js','dev','--host','127.0.0.1','--port','4327'],{cwd:process.cwd(),env:{...process.env,SUPABASE_URL:`http://127.0.0.1:${dbPort}`},stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',data=>log+=String(data));server.stderr.on('data',data=>log+=String(data));
  const origin='http://127.0.0.1:4327';
  try {
    let ready=false;
    for(let attempt=0;attempt<100;attempt++) {
      try {const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}
      if(server.exitCode!==null)throw new Error(`Dev server exited: ${log}`);
      await pause(100);
    }
    assert.equal(ready,true,'Dev server should start');
    for(const path of ['/collection','/checkout','/account','/visit']) {
      const response=await fetch(origin+path);assert.equal(response.status,200);
      const html=await response.text();
      const script=html.match(/<script[^>]*id="nicoo-catalogue"[^>]*>(.*?)<\/script>/s)?.[1];assert.ok(script);
      const catalogue=JSON.parse(script!);assert.equal(catalogue.find((p:any)=>p.id===10000).price,14500);
      assert.equal(script!.includes('</script>'),false);assert.equal(catalogue.find((p:any)=>p.id===10000).name,row.name);
      if(path==='/collection'){assert.ok(html.includes('data-product="10000"'));assert.ok(html.includes('src="'+row.image+'"'));assert.ok(html.includes('Grey desk &lt;/script&gt;'));}
      if(path==='/account'||path==='/visit')assert.ok(html.includes('value="10000"'));
    }
    const admin=await fetch(origin+'/admin/products');assert.equal(admin.status,200);assert.equal(admin.headers.get('X-Robots-Tag'),'noindex, nofollow');
    const html=await admin.text();assert.ok(html.includes('id="admin-workspace" hidden'));assert.ok(html.includes('Publish to the shop'));
    for(const method of ['GET','POST'])assert.equal((await fetch(origin+'/api/admin/products',{method})).status,401);
  }finally {server.kill('SIGTERM');await new Promise<void>(resolve=>db.close(()=>resolve()));}
});
