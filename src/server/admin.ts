import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {env} from './config';
import {HttpError} from './http';
export const ADMIN_COOKIE='nicoo-upload-session';
const lifetime=8*60*60;
function password() {
  const value=env('ADMIN_UPLOAD_PASSWORD');
  if(!value)throw new HttpError(503,'The shop login is not configured yet.');
  return value;
}
function sessionKey(){return createHash('sha256').update(env('ADMIN_UPLOAD_SESSION_SECRET')+'\0'+password()).digest();}
function signature(value:string){return createHmac('sha256',sessionKey()).update(value).digest('hex');}
export function checkAdminPassword(username:unknown,input:unknown) {
  if(typeof input!=='string'||input.length>200)return false;
  const expected=createHash('sha256').update(password()).digest();
  const actual=createHash('sha256').update(input).digest();
  return timingSafeEqual(actual,expected)&&username==='admin';
}
export function createAdminSession(now=Date.now()) {
  const value=`${Math.floor(now/1000)+lifetime}.${randomBytes(16).toString('hex')}`;
  return `${value}.${signature(value)}`;
}
export function validAdminSession(token:string,now=Date.now()) {
  if(!/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return false;
  const [expires,nonce,mac]=token.split('.');
  if(Number(expires)<=Math.floor(now/1000))return false;
  return timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(`${expires}.${nonce}`),'hex'));
}
export function sameOrigin(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Please submit from the shop website.');
}
export function authenticatedAdmin(request:Request) {
  const token=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1)||'';
  return validAdminSession(token);
}
export async function requireAdmin(request:Request) {
  if(!authenticatedAdmin(request))throw new HttpError(401,'Please log in to add furniture.');
  if(!['GET','HEAD'].includes(request.method))sameOrigin(request);
  return 'shop_admin';
}
export function adminCookie(request:Request,token:string) {
  return `${ADMIN_COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${token?lifetime:0}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
