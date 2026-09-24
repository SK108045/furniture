import {database} from '../src/server/database';
try {
  for(const table of ['nicoo_orders','nicoo_profiles','nicoo_payment_callbacks','nicoo_checkout_attempts'])await database(`${table}?select=*&limit=0`);
  console.log('Supabase connection and all four tables are ready.');
} catch(error) {console.error(error instanceof Error?error.message:'Database check failed.');process.exitCode=1;}
