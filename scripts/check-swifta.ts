import {env} from '../src/server/config';
const address=process.argv[2];
if(!address||!env('SWIFTA_CALLBACK_TOKEN')){
  console.error('Usage: npm run payment:check -- https://your-vercel-domain (requires SWIFTA_CALLBACK_TOKEN in .env)');process.exit(1);
}
const url=new URL(address);
if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use the HTTPS address of your own deployment.');
url.pathname='/api/swifta/diagnostic';url.search='';url.hash='';
try {
  const response=await fetch(url,{method:'POST',headers:{'x-webhook-secret':env('SWIFTA_CALLBACK_TOKEN')},redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`Diagnostic endpoint returned HTTP ${response.status}. Deploy the latest code and use its matching callback token.`);
  const report=await response.json();console.log(JSON.stringify(report,null,2));
  console.log(report.reachable?'Vercel reached the Swifta validation endpoint. No payment was requested.':'Swifta did not return its expected validation response. Use the status and gateway request ID above to investigate.');
  if(!report.reachable)process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:'Diagnostic failed.');process.exitCode=1;}
