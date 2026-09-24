import type {APIRoute} from 'astro';
import {authorizeCallback} from '../../../server/callbacks';
import {env} from '../../../server/config';
import {failure,json} from '../../../server/http';

// Merchant-only connectivity probe. No phone, amount, or order is submitted.
// Swifta's validated response to this empty payload is HTTP 400 JSON.
export const POST:APIRoute=async({request})=>{
  try {
    authorizeCallback(request);
    const response=await fetch('https://app.swifta.co.ke/stkpush',{
      method:'POST',headers:{'x-api-key':env('SWIFTA_API_KEY'),'Content-Type':'application/json',Accept:'application/json'},
      body:'{}',redirect:'manual',signal:AbortSignal.timeout(15000),
    });
    const raw=await response.text();
    let data:any;try{data=JSON.parse(raw);}catch{}
    const reachable=response.status===400&&data?.success===false&&data?.message==='phone and amount required';
    const report={reachable,httpStatus:response.status,contentType:response.headers.get('content-type'),gatewayRequestId:response.headers.get('cf-ray'),challenge:response.headers.get('cf-mitigated')==='challenge',responseFormat:data?'json':/^\s*</.test(raw)?'html':raw.trim()?'text':'empty'};
    console.info('Swifta connectivity diagnostic',JSON.stringify(report));
    return json(report);
  }catch(error){return failure(error);}
};
