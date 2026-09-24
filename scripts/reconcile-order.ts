// Merchant-only CLI fallback, used after checking a transaction in Swifta.
// Never expose this script as a customer-facing API.
import {db} from '../src/server/database';
import type {OrderRow} from '../src/server/orders';
const [id,status,receipt]=process.argv.slice(2);
if(!id||!['paid','failed'].includes(status)||status==='paid'&&!/^[A-Z0-9]{8,30}$/i.test(receipt||'')){
  console.error('Usage: npm run order:reconcile -- NF-YYMMDD-XXXXXXXX paid MPESA_RECEIPT\n   or: npm run order:reconcile -- NF-YYMMDD-XXXXXXXX failed');process.exit(1);
}
const row=db().prepare('SELECT * FROM orders WHERE id=?').get(id) as OrderRow|undefined;
if(!row){console.error('Order not found.');process.exit(1);}
if(row.status==='paid'){console.error('Order is already paid. No change made.');process.exit(1);}
db().prepare('UPDATE orders SET status=?,receipt=?,payment_note=?,updated_at=? WHERE id=?').run(status,status==='paid'?receipt.toUpperCase():null,status==='paid'?'Your M-Pesa payment has been confirmed by the shop. Thank you!':'The shop confirmed that this payment was not completed. You can try checkout again.',new Date().toISOString(),id);
console.log(`${id}: ${status}`);
