// Merchant-only: verify the transaction in Swifta before using this command.
import {rpc} from '../src/server/database';
const [id,status,receipt]=process.argv.slice(2);
if(!id||!['paid','failed'].includes(status)||status==='paid'&&!/^[A-Z0-9]{8,30}$/i.test(receipt||'')){
  console.error('Usage: npm run order:reconcile -- NF-YYMMDD-XXXXXXXX paid MPESA_RECEIPT\nOr: npm run order:reconcile -- NF-YYMMDD-XXXXXXXX failed');process.exit(1);
}
try {
  await rpc('nicoo_reconcile_order',{p_id:id,p_status:status,p_receipt:status==='paid'?receipt.toUpperCase():null});
  console.log(`${id}: ${status}`);
}catch(error){console.error(error instanceof Error?error.message:'Reconciliation failed.');process.exitCode=1;}
