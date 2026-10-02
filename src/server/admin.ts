import {clerkClient, requireUser} from './auth';
import {env} from './config';
import {HttpError} from './http';

export function isAdmin(userId:string, privateMetadata:Record<string,unknown>, allowlist:string) {
  return privateMetadata.role==='admin' || allowlist.split(',').map(id=>id.trim()).filter(Boolean).includes(userId);
}
export async function requireAdmin(request:Request) {
  const userId=await requireUser(request);
  const user=await clerkClient().users.getUser(userId);
  // Unsafe metadata and client-supplied roles never grant access.
  if(!isAdmin(userId,user.privateMetadata,env('ADMIN_CLERK_USER_IDS')))throw new HttpError(403,'This page is only available to the shop admin.');
  return userId;
}
