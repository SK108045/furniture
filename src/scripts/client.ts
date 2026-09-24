import {clerkHost} from './auth-config.mjs';
export type ClerkClient = {
  isSignedIn: boolean; user?: any; session?: {getToken: () => Promise<string | null>; currentTask?: unknown}; client: any;
  load: (options: object) => Promise<void>; setActive: (options: object) => Promise<void>;
  mountUserProfile: (element: HTMLElement, options: object) => void;
  addListener: (listener: () => void) => unknown; signOut: (options: object) => Promise<void>;
};
declare global { interface Window { Clerk?: ClerkClient; __internal_ClerkUICtor?: unknown; } }
function script(src: string, key?: string) {
  return new Promise<void>((resolve,reject) => {
    const el = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('Account connection timed out. Reload to try again.')),20000);
    el.src=src; el.async=true; el.crossOrigin='anonymous';
    if(key) el.dataset.clerkPublishableKey=key;
    el.onload=()=>{clearTimeout(timer);resolve();};
    el.onerror=()=>{clearTimeout(timer);reject(new Error('Could not connect to accounts. Reload to try again.'));};
    document.head.append(el);
  });
}
export const authReady: Promise<ClerkClient> = (async () => {
  // SSR supplies the current public key; the compiled value covers static pages.
  const key=document.querySelector<HTMLMetaElement>('meta[name="clerk-publishable-key"]')?.content.trim() || import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const host=clerkHost(key);
  if(!host) throw new Error('Accounts are temporarily unavailable. Please contact the shop.');
  await Promise.all([script(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`),script(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,key)]);
  const clerk=window.Clerk;
  if(!clerk || !window.__internal_ClerkUICtor) throw new Error('Accounts could not load. Please reload.');
  await clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor},signInUrl:'/sign-in',signUpUrl:'/sign-up'});
  return clerk;
})();
// Every consuming page presents its own recovery state.
void authReady.catch(()=>{});
export async function api(path: string, options: RequestInit = {}) {
  const clerk=await authReady;
  const token=await clerk.session?.getToken();
  if(!token) throw new Error('Please sign in to continue.');
  const response=await fetch(path,{...options,signal:options.signal||AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
  const data=await response.json();
  if(!response.ok) throw Object.assign(new Error(data.error || 'Could not complete your request.'),{status:response.status});
  return data;
}
export function errorMessage(error: any) { return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || 'Please try again.'; }
export const appearance={variables:{colorPrimary:'#284b37',colorText:'#242924',colorBackground:'#faf9f6',borderRadius:'8px',fontFamily:'Arial, sans-serif'},elements:{rootBox:'auth-clerk-root',card:'auth-clerk-card',formButtonPrimary:'auth-clerk-button',profileSection__connectedAccounts:{display:'none'}}};
