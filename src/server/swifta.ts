import { env } from './config';
export type PushResult = {status: 'pending' | 'failed' | 'uncertain'; providerId: string | null; note: string};
// An accepted STK request is not proof of payment. Only reconciliation can mark an order paid.
export async function requestStk(order: {id: string; total: number; phone: string}, fetcher: typeof fetch = fetch): Promise<PushResult> {
  try {
    const response = await fetcher('https://app.swifta.co.ke/stkpush', {
      method: 'POST', headers: {'x-api-key': env('SWIFTA_API_KEY'), 'Content-Type': 'application/json'},
      body: JSON.stringify({phone: order.phone, amount: order.total, accountReference: `Nicoo Furnitures ${order.id}`, description: `Furniture order ${order.id}`}),
      signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    let data: any;
    try { data = await response.json(); } catch { return {status:'uncertain',providerId:null,note:'The payment service returned an unexpected response. Please contact the shop before retrying.'}; }
    const result = data?.data || data;
    const providerId = result?.CheckoutRequestID || result?.checkoutRequestId || result?.checkout_request_id || null;
    const code = result?.ResponseCode ?? result?.responseCode;
    if (response.status >= 500) return {status:'uncertain',providerId,note:'The payment service could not confirm the request. Check your phone and contact the shop before retrying.'};
    if (!response.ok || data?.success === false || (code !== undefined && String(code) !== '0')) return {status:'failed',providerId,note:'The payment request was declined. Check your M-Pesa number and try again, or contact the shop.'};
    if (String(code) === '0' || data?.success === true || providerId) return {status:'pending',providerId,note:'Check your phone for the M-Pesa prompt. Your order is awaiting payment confirmation.'};
    return {status:'uncertain',providerId,note:'Your request was sent, but its status could not be confirmed. Contact the shop with your order reference.'};
  } catch {
    return {status:'uncertain',providerId:null,note:'The connection timed out or was interrupted. An M-Pesa prompt may still arrive. Contact the shop before trying another payment.'};
  }
}
