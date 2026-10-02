import {appOrigins} from './config';
import {HttpError} from './http';
function publicOrigin(request:Request) {
  const url=new URL(request.url);
  // Vercel terminates HTTPS before invoking the Node server. Its internal
  // request URL can therefore use HTTP even though the browser uses HTTPS.
  if(process.env.VERCEL==='1')url.protocol='https:';
  return url.origin;
}
export function sameOrigin(request:Request) {
  const origins=new Set([publicOrigin(request)]);
  if(process.env.VERCEL==='1')for(const origin of appOrigins(request))if(origin.startsWith('https://'))origins.add(origin);
  if(!origins.has(request.headers.get('origin')||''))throw new HttpError(403,'Please submit from the shop website.');
}
