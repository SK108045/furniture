import type {APIRoute} from 'astro';
import {adminCookie,authenticatedAdmin,checkAdminPassword,createAdminSession,sameOrigin} from '../../../server/admin';
import {body,failure,HttpError,json} from '../../../server/http';
export const prerender=false;
const attempts=new Map<string,{count:number;until:number}>();
export const GET:APIRoute=async({request})=>{
  try{return json({authenticated:authenticatedAdmin(request)});}catch(error){return failure(error);}
};
export const POST:APIRoute=async({request})=>{
  try {
    sameOrigin(request);
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
    const previous=attempts.get(ip);
    if(previous&&previous.until>Date.now()&&previous.count>=8)throw new HttpError(429,'Too many attempts. Please try again in five minutes.');
    const input=await body(request);
    if(!checkAdminPassword(input?.username,input?.password)) {
      if(attempts.size>500)attempts.clear();
      attempts.set(ip,{count:previous&&previous.until>Date.now()?previous.count+1:1,until:Date.now()+5*60*1000});
      throw new HttpError(401,'The username or password is incorrect.');
    }
    attempts.delete(ip);
    const response=json({authenticated:true});response.headers.set('Set-Cookie',adminCookie(request,createAdminSession()));return response;
  }catch(error){return failure(error);}
};
export const DELETE:APIRoute=async({request})=>{
  try {sameOrigin(request);const response=json({authenticated:false});response.headers.set('Set-Cookie',adminCookie(request,''));return response;}
  catch(error){return failure(error);}
};
