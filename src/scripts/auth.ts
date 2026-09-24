import { safeDestination } from './auth-config.mjs';
import {authReady, appearance, errorMessage} from './client';
const page=document.querySelector<HTMLElement>('[data-auth-page]');
const status=page?.querySelector<HTMLElement>('[data-auth-status]');
const destination=safeDestination(new URLSearchParams(location.search).get('next'));
const switchLink=document.querySelector<HTMLAnchorElement>('[data-auth-switch]');
if(switchLink) switchLink.href+=`?next=${encodeURIComponent(destination)}`;
async function init() {
  try {
    const clerk=await authReady;
    const update=()=>{
      document.querySelectorAll<HTMLAnchorElement>('[data-account-link]').forEach(link=>{
        link.href=clerk.isSignedIn?'/account':'/sign-in';
        const label=link.querySelector('[data-account-label]');
        if(label) label.textContent=clerk.isSignedIn?'My account':'Sign in';
      });
      if(page?.dataset.authPage==='account'&&!clerk.isSignedIn) location.replace('/sign-in?next=/account');
    };
    update();clerk.addListener(update);
    if(!page) return;
    const mode=page.dataset.authPage;
    if(mode!=='account'&&clerk.isSignedIn){location.replace(destination);return;}
    if(mode==='account'){
      if(!clerk.isSignedIn)return;
      page.querySelector('[data-account-content]')?.removeAttribute('hidden');
      const name=page.querySelector('[data-customer-name]');
      if(name)name.textContent=clerk.user?.firstName?`, ${clerk.user.firstName}`:'';
      const widget=page.querySelector<HTMLElement>('[data-auth-widget]');
      if(widget)clerk.mountUserProfile(widget,{routing:'hash',appearance});
      page.querySelector<HTMLButtonElement>('[data-sign-out]')?.addEventListener('click',async event=>{
        const button=event.currentTarget as HTMLButtonElement;button.disabled=true;
        try{await clerk.signOut({redirectUrl:'/'});}catch(error){button.disabled=false;if(status)status.textContent=errorMessage(error);}
      });
      void import('./account');
    } else {
      const form=page.querySelector<HTMLFormElement>('[data-email-auth]')!;
      form.hidden=false;
      const identity=form.querySelector<HTMLElement>('[data-identity-fields]')!;
      const verification=form.querySelector<HTMLElement>('[data-verification-fields]')!;
      const passwordLabel=form.querySelector<HTMLElement>('[data-password-field]')!;
      const password=form.querySelector<HTMLInputElement>('[name="password"]')!;
      const email=form.querySelector<HTMLInputElement>('[name="email"]')!;
      const code=form.querySelector<HTMLInputElement>('[name="code"]')!;
      const submit=form.querySelector<HTMLButtonElement>('[type="submit"]')!;
      const resetButton=form.querySelector<HTMLButtonElement>('[data-reset-password]');
      const emailButton=form.querySelector<HTMLButtonElement>('[data-email-code]');
      const resend=form.querySelector<HTMLButtonElement>('[data-resend]')!;
      const back=form.querySelector<HTMLButtonElement>('[data-auth-back]')!;
      let flow=mode==='sign-up'?'signup':'signin';
      let verifying=false;
      let emailAddressId='';
      let resendAt=0;
      function render(){
        identity.hidden=verifying;email.required=!verifying;
        verification.hidden=!verifying;code.required=verifying;
        passwordLabel.hidden=verifying?flow!=='reset':flow==='email'||flow==='reset';
        password.required=!passwordLabel.hidden;
        password.autocomplete=flow==='signup'||flow==='reset'?'new-password':'current-password';
        password.minLength=flow==='signin'?1:15;
        submit.textContent=verifying?(flow==='reset'?'Reset password & sign in':'Verify & continue'):(flow==='signup'?'Create your account':flow==='signin'?'Sign in':'Send email code');
        if(resetButton)resetButton.hidden=verifying||flow!=='signin';
        if(emailButton)emailButton.hidden=verifying||flow!=='signin';
        back.hidden=flow==='signup'?!verifying:flow==='signin'&&!verifying;
      }
      async function sendCode(){
        if(flow==='signup')await clerk.client.signUp.prepareEmailAddressVerification({strategy:'email_code'});
        else if(flow==='reset')await clerk.client.signIn.create({strategy:'reset_password_email_code',identifier:email.value.trim()});
        else await clerk.client.signIn.prepareFirstFactor({strategy:'email_code',emailAddressId});
        resendAt=Date.now()+30000;
      }
      async function finish(result: any){
        if(result.status!=='complete')throw new Error('An additional verification step is required. Please contact the shop for help with your account.');
        await clerk.setActive({session:result.createdSessionId});
        if(clerk.session?.currentTask)throw new Error('Your account needs an additional setup step. Please open your Clerk account portal to finish it.');
        location.assign(destination);
      }
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;if(status)status.textContent='Please wait…';
        try{
          if(verifying){
            const result=flow==='signup'?await clerk.client.signUp.attemptEmailAddressVerification({code:code.value.trim()}):await clerk.client.signIn.attemptFirstFactor({strategy:flow==='reset'?'reset_password_email_code':'email_code',code:code.value.trim(),...(flow==='reset'?{password:password.value}:{})});
            await finish(result);return;
          }
          if(flow==='signup'){
            await clerk.client.signUp.create({emailAddress:email.value.trim(),password:password.value});
            await sendCode();
          } else if(flow==='signin'){
            const result=await clerk.client.signIn.create({identifier:email.value.trim(),password:password.value});
            if(result.status==='complete'){await finish(result);return;}
            const factor=result.supportedFirstFactors?.find((f:any)=>f.strategy==='email_code');
            if(!factor)throw new Error('Please use “Sign in with an email code” to verify your email.');
            emailAddressId=factor.emailAddressId;flow='email';await sendCode();
          } else if(flow==='reset')await sendCode();
          else{
            const result=await clerk.client.signIn.create({identifier:email.value.trim()});
            const factor=result.supportedFirstFactors?.find((f:any)=>f.strategy==='email_code');
            if(!factor)throw new Error('Email-code sign-in is not available for this account. Please use your password.');
            emailAddressId=factor.emailAddressId;await sendCode();
          }
          verifying=true;render();if(status)status.textContent=`We sent a verification code to ${email.value.trim()}.`;code.focus();
        }catch(error){if(status)status.textContent=errorMessage(error);}finally{submit.disabled=false;}
      });
      resetButton?.addEventListener('click',()=>{flow='reset';render();if(status)status.textContent='Enter your email to reset your password.';});
      emailButton?.addEventListener('click',()=>{flow='email';render();if(status)status.textContent='We’ll email you a one-time sign-in code.';});
      back.addEventListener('click',()=>{verifying=false;flow=mode==='sign-up'?'signup':'signin';code.value='';render();if(status)status.textContent='';});
      resend.addEventListener('click',async()=>{
        if(Date.now()<resendAt){if(status)status.textContent='Please wait 30 seconds before requesting another code.';return;}
        resend.disabled=true;try{await sendCode();if(status)status.textContent='A fresh code is on its way. Check your inbox.';}catch(error){if(status)status.textContent=errorMessage(error);}finally{resend.disabled=false;}
      });
      render();
    }
    if(status)status.textContent='';
  }catch(error){if(status)status.textContent=errorMessage(error);page?.querySelector('[data-auth-fallback]')?.removeAttribute('hidden');}
}
void init();
