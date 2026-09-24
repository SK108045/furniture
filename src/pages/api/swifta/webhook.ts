import type {APIRoute} from 'astro';
import {authorizeWebhook,normalizeCallback,receiveCallback} from '../../../server/callbacks';
import {failure,HttpError,json} from '../../../server/http';
export const POST: APIRoute = async ({request})=>{
  try {
    const raw=await request.text();
    if(raw.length>16000)throw new HttpError(413,'Webhook payload is too large.');
    authorizeWebhook(request,raw);
    let payload:any;try{payload=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON.');}
    const event=payload?.event||payload?.event_type||payload?.type;
    if(!['payment.success','payment.failed','stk.timeout'].includes(event))return json({ok:true,status:'ignored'});
    await receiveCallback(normalizeCallback(payload));
    return json({ok:true,status:'processed'});
  }catch(error){return failure(error);}
};
