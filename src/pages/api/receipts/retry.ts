import type {APIRoute} from 'astro';
import {timingSafeEqual} from 'node:crypto';
import {env} from '../../../server/config';
import {json} from '../../../server/http';
import {deliverReceipts} from '../../../server/receipt-emails';
export const GET:APIRoute=async({request})=>{
  const secret=env('CRON_SECRET'),provided=request.headers.get('authorization')||'';
  const expected=`Bearer ${secret}`;
  if(!secret||provided.length!==expected.length||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return json({error:'Unauthorized'},401);
  return json(await deliverReceipts(null,null,3));
};
