import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {uploadedProduct} from '../src/server/catalogue';

test('admin upload UI works on desktop/mobile and uploaded items reach the existing bag',async()=>{
  const row={id:10000,name:'Grey office desk',category:'Desks',price:14500,image:'https://example.supabase.co/storage/v1/object/public/nicoo-products/desk.jpg',created_at:'2026-10-02T12:00:00Z',created_by:'user_admin',upload_key:'12345678-1234-4123-8123-123456789abc'};
  const photo=await sharp({create:{width:600,height:600,channels:3,background:'#d9ded2'}}).jpeg().toBuffer();
  const db=createServer((_request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify([row]));});
  await new Promise<void>(resolve=>db.listen(0,'127.0.0.1',resolve));
  const server=spawn(process.execPath,['node_modules/astro/astro.js','dev','--host','127.0.0.1','--port','4328'],{env:{...process.env,ADMIN_UPLOAD_PASSWORD:'test-upload-password',ADMIN_UPLOAD_SESSION_SECRET:'test-only-session-secret',SUPABASE_URL:`http://127.0.0.1:${(db.address() as any).port}`},stdio:'ignore'});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--in-process-gpu','--ignore-gpu-blocklist']});
  try {
    for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4328')).ok)break;}catch{}await pause(100);}
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route(/\/npm\/@clerk\//,route=>route.abort());
    await page.route(/\/images\/|example\.supabase\.co\/storage/,route=>route.fulfill({contentType:'image/jpeg',body:photo}));
    let uploads=0;
    await page.route('**/api/admin/products',async route=>{
      if(route.request().method()==='POST') {
        uploads++;assert.ok(route.request().headers().cookie?.includes('nicoo-upload-session='));assert.equal(route.request().headers().authorization,undefined);const body=route.request().postDataBuffer()!.toString();assert.ok(body.includes('14500'));assert.ok(body.includes('name="photo"'));
        await route.fulfill({status:201,json:{product:uploadedProduct(row),assisted:true,replayed:false}});
      }else await route.continue();
    });
    await page.goto('http://127.0.0.1:4328/admin/products');
    await page.locator('#admin-login-form').waitFor({state:'visible'});
    await page.locator('#admin-password').fill('wrong-password');await page.locator('#admin-login-button').click();
    await page.locator('#admin-login-error').waitFor({state:'visible'});assert.match(await page.locator('#admin-login-error').innerText(),/incorrect/);
    await page.locator('#admin-password').fill('test-upload-password');await page.locator('#admin-login-button').click();
    await page.locator('#admin-workspace').waitFor({state:'visible'});
    await page.reload();await page.locator('#admin-workspace').waitFor({state:'visible'});
    await mkdir('/tmp/furniture-ui',{recursive:true});
    await page.screenshot({path:'/tmp/furniture-ui/admin-desktop.png',fullPage:true});
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin form must fit the mobile viewport');
      assert.ok(await page.locator('#admin-publish').isVisible());
    }
    await page.setViewportSize({width:390,height:1000});
    await page.screenshot({path:'/tmp/furniture-ui/admin-mobile.png',fullPage:true});
    await page.locator('#admin-photo').setInputFiles({name:'desk.jpg',mimeType:'image/jpeg',buffer:photo});
    await page.locator('#admin-photo-preview').waitFor({state:'visible'});
    await page.locator('#admin-price').fill('14500');
    await page.locator('#admin-publish').click();
    await page.waitForFunction(()=>document.querySelector('#admin-upload-status')?.getAttribute('data-state')==='success');
    assert.equal(uploads,1);assert.match(await page.locator('#admin-upload-status').innerText(),/Grey office desk · Desks · KSh 14,500/);
    assert.equal(await page.locator('#admin-published-list a').count(),1);
    await page.goto('http://127.0.0.1:4328/collection?category=Desks#all-products');
    await page.locator('#cart-items .empty-cart').waitFor({state:'attached'});
    await page.locator('[data-add="10000"]').click();
    await page.locator('[data-cart-open]').click();
    assert.match(await page.locator('#cart-items').innerText(),/Grey office desk/);
    assert.equal(await page.locator('#cart-items img').getAttribute('src'),row.image);
    await page.locator('#cart-summary a').click();
    await page.waitForURL('**/checkout');
    assert.match(await page.locator('#checkout-items').innerText(),/Grey office desk/);
    assert.match(await page.locator('#checkout-total').innerText(),/14,500/);
    await page.goto('http://127.0.0.1:4328/admin/products');await page.locator('#admin-workspace').waitFor({state:'visible'});
    await page.locator('#admin-logout').click();await page.locator('#admin-login-form').waitFor({state:'visible'});
    assert.equal((await page.request.get('http://127.0.0.1:4328/api/admin/products')).status(),401);
    assert.deepEqual(errors,[]);
    await page.close();
  }finally {await browser.close();server.kill('SIGTERM');await new Promise<void>(resolve=>db.close(()=>resolve()));}
});
