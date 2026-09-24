import type {APIRoute} from 'astro';
import {authorizeCallback,normalizeCallback,receiveCallback} from '../../../server/callbacks';
import {body,failure,json} from '../../../server/http';
export const POST: APIRoute = async ({request})=>{
  try {authorizeCallback(request);receiveCallback(normalizeCallback(await body(request)));return json({ResultCode:0,ResultDesc:'Accepted'});}
  catch(error){return failure(error);}
};
