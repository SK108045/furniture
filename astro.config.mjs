import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import {readFileSync, existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {clerkHost} from './src/scripts/auth-config.mjs';

// Resolve the committed .env explicitly, including when Vercel defines an empty
// variable. Never add private keys to Vite's client-side `define` configuration.
const mode=process.env.NODE_ENV || 'development';
const files={};
for(const name of ['.env','.env.local',`.env.${mode}`,`.env.${mode}.local`]){
  const path=new URL(name,import.meta.url);
  if(existsSync(path))Object.assign(files,parseEnv(readFileSync(path,'utf8')));
}
function setting(name){return process.env[name]?.trim() || files[name]?.trim() || '';}
const publishableKey=setting('PUBLIC_CLERK_PUBLISHABLE_KEY');
if(!clerkHost(publishableKey))throw new Error('Missing or invalid PUBLIC_CLERK_PUBLISHABLE_KEY. Include the project .env in this deployment or set the key in Vercel, then rebuild.');
for(const name of ['CLERK_SECRET_KEY','SUPABASE_URL','SWIFTA_API_KEY']){
  if(!setting(name))throw new Error(`Missing ${name}. Include the project .env or set this value in Vercel before building.`);
}
if(!setting('SUPABASE_SECRET_KEY')&&!setting('SUPABASE_SERVICE_ROLE_KEY'))throw new Error('Missing Supabase server key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY before building.');
// Blank overrides must not mask file values in Astro's server environment loader.
for(const name of Object.keys(files))if(!process.env[name]?.trim())delete process.env[name];
process.env.PUBLIC_CLERK_PUBLISHABLE_KEY=publishableKey;
// Astro's Node adapter discards Host/forwarded Host unless it matches this
// list. Keep the public URL intact for form-origin checks behind Vercel.
const allowedHostnames=new Set(['furniture-chi-eight.vercel.app','localhost','127.0.0.1']);
for(const value of [setting('APP_ORIGIN'),process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
  if(value)allowedHostnames.add(new URL(value.includes('://')?value:`https://${value}`).hostname);
}
export default defineConfig({
  output:'server',adapter:vercel({maxDuration:60}),
  security:{allowedDomains:[...allowedHostnames].map(hostname=>({hostname}))},
  vite:{plugins:[tailwindcss()],define:{'import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY':JSON.stringify(publishableKey)}},
});
