import {env} from './config';
import {HttpError} from './http';

// Supabase's HTTPS Data API works in Vercel functions without a local database,
// native SQLite binaries, or persistent TCP connections. Never import in a client script.
export async function database<T>(resource:string, options:RequestInit={}):Promise<T> {
  const url=env('SUPABASE_URL');
  const secret=env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!secret)throw new HttpError(503,'Database setup is incomplete. Add the Supabase project URL and server secret key.');
  const headers:Record<string,string>={'Content-Type':'application/json',apikey:secret};
  if(secret.startsWith('eyJ'))headers.Authorization=`Bearer ${secret}`;
  let response:Response;
  try {
    response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${resource}`,{
      ...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000),redirect:'error',
    });
  } catch {throw new HttpError(503,'The database could not be reached. Please try again shortly.');}
  const text=await response.text();
  let data:any=null;
  if(text){try{data=JSON.parse(text);}catch{throw new HttpError(502,'The database returned an unexpected response.');}}
  if(!response.ok){
    if(/^PT(400|403|404|409|429)$/.test(data?.code||''))throw new HttpError(Number(data.code.slice(2)),data.message);
    console.error('Supabase request failed:',response.status,data?.code||'unknown');
    if(['PGRST202','PGRST205','42P01','42883'].includes(data?.code))throw new HttpError(503,'Database tables are not ready. Run supabase/schema.sql in the Supabase SQL Editor.');
    if(response.status===401||response.status===403)throw new HttpError(503,'The Supabase server key or database permissions need updating.');
    if(data?.code==='23505')throw new HttpError(409,'This record already exists. Refresh and try again.');
    throw new HttpError(503,'The database could not save this change. Please try again.');
  }
  return data as T;
}
export const query=(params:Record<string,string>)=>new URLSearchParams(params).toString();
export const rpc=<T>(name:string,params:object)=>database<T>(`rpc/${name}`,{method:'POST',body:JSON.stringify(params)});
