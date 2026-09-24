import { env } from './config';
export type PushResult = {status: 'pending' | 'failed' | 'uncertain'; providerId: string | null; note: string};
// An accepted STK request is not proof of payment. Only reconciliation can mark an order paid.
export async function requestStk(order: {id: string; total: number; phone: string}, fetcher: typeof fetch = fetch): Promise<PushResult> {
  try {
    const response = await fetcher('https://app.swifta.co.ke/stkpush', {
      method: 'POST', headers: {'x-api-key': env('SWIFTA_API_KEY'), 'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({phone: order.phone, amount: order.total, accountReference: `Nicoo Furnitures ${order.id}`, description: `Furniture order ${order.id}`}),
      signal: AbortSignal.timeout(20000), redirect: 'manual',
    });
    const raw=await response.text();
    const challenge=response.headers.get('cf-mitigated')==='challenge';
    const diagnostic={
      orderId:order.id,httpStatus:response.status,contentType:response.headers.get('content-type'),
      gateway:response.headers.get('server'),gatewayRequestId:response.headers.get('cf-ray'),
      upstreamRequestId:response.headers.get('x-request-id'),challenge,
      responseFormat:/^\s*</.test(raw)?'html':raw.trim()?'text':'empty',
    };
    // Never log request bodies, API keys, phone numbers or raw provider bodies.
    let data: any;
    try { data=JSON.parse(raw.replace(/^\uFEFF/,'')); }
    catch {
      console.error('Swifta STK response',JSON.stringify({...diagnostic,reason:'non_json_response'}));
      // Explicit edge/auth/rate-limit rejections did not accept an STK request.
      // An empty 2xx or a server error is ambiguous: do not encourage a second debit.
      const rejected=challenge||[400,401,403,404,405,413,415,422,429].includes(response.status);
      const note=challenge||response.status===403
        ? 'The payment gateway blocked the shop’s request. Please contact the shop with this order reference.'
        : response.status===401?'The payment gateway rejected the shop’s credentials. Please contact the shop.'
        : response.status===429?'The payment gateway is busy. Please wait a few minutes before trying again.'
        : rejected?`The payment gateway rejected the request (HTTP ${response.status}). Please contact the shop if this continues.`
        : `The payment gateway could not confirm the request (HTTP ${response.status}). Check your phone and contact the shop before retrying.`;
      return {status:rejected?'failed':'uncertain',providerId:null,note};
    }
    const result = data?.data || data;
    const rawId = result?.CheckoutRequestID || result?.checkoutRequestId || result?.checkout_request_id;
    const providerId = typeof rawId==='string'&&rawId.length<=200?rawId:null;
    const code = result?.ResponseCode ?? result?.responseCode ?? result?.response_code;
    console.info('Swifta STK response',JSON.stringify({...diagnostic,responseFormat:'json',providerId,responseCode:typeof code==='string'||typeof code==='number'?String(code).slice(0,40):null,accepted:data?.success===true||result?.success===true}));
    if (response.status >= 500) return {status:'uncertain',providerId,note:'The payment service could not confirm the request. Check your phone and contact the shop before retrying.'};
    if (response.status===408) return {status:'uncertain',providerId,note:'The payment gateway timed out before confirming the request. Check your phone and contact the shop before retrying.'};
    if (response.status>=300&&response.status<400) return {status:'uncertain',providerId,note:'The payment gateway redirected the request instead of confirming it. Please contact the shop before retrying.'};
    if (!response.ok || data?.success === false || result?.success===false || (code !== undefined && String(code) !== '0')) return {status:'failed',providerId,note:'The payment request was declined. Check your M-Pesa number and try again, or contact the shop.'};
    if (String(code) === '0' || data?.success === true || result?.success===true || providerId) return {status:'pending',providerId,note:'Check your phone for the M-Pesa prompt. Your order is awaiting payment confirmation.'};
    return {status:'uncertain',providerId,note:'Your request was sent, but its status could not be confirmed. Contact the shop with your order reference.'};
  } catch(error) {
    console.error('Swifta STK transport',JSON.stringify({orderId:order.id,reason:error instanceof Error?error.name:'UnknownError'}));
    return {status:'uncertain',providerId:null,note:'The connection timed out or was interrupted. An M-Pesa prompt may still arrive. Contact the shop before trying another payment.'};
  }
}
