import { createHash, randomBytes } from 'node:crypto';
import { db } from './database';
import { HttpError } from './http';
import { orderInput } from './validation';
export type OrderStatus = 'requesting' | 'pending' | 'uncertain' | 'failed' | 'paid';
export type OrderRow = {id: string; user_id: string; idempotency_key: string; fingerprint: string; created_at: string; updated_at: string; status: OrderStatus; total: number; details: string; provider_id: string | null; receipt: string | null; payment_note: string | null};
export function publicOrder(row: OrderRow) {
  return {id: row.id, createdAt: row.created_at, status: row.status, total: row.total, ...JSON.parse(row.details), receipt: row.receipt, paymentNote: row.payment_note};
}
export function getOrder(id: string, userId: string) {
  const row = db().prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, userId) as OrderRow | undefined;
  if (!row) throw new HttpError(404, 'Order not found.');
  return row;
}
export function createOrder(userId: string, key: string, input: ReturnType<typeof orderInput>, email: string) {
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db().transaction(() => {
    const previous = db().prepare('SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?').get(userId, key) as OrderRow | undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'This checkout attempt already exists. Open your account to review it.');
      return {row: previous, created: false};
    }
    const outstanding = db().prepare("SELECT id FROM orders WHERE user_id = ? AND status IN ('requesting','pending','uncertain') LIMIT 1").get(userId) as {id: string} | undefined;
    if (outstanding) throw new HttpError(409, `Order ${outstanding.id} is awaiting payment confirmation. Review it in your account before placing another order.`);
    const recent = db().prepare("SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND created_at > ?").get(userId, new Date(Date.now()-600000).toISOString()) as {count: number};
    if (recent.count >= 5) throw new HttpError(429, 'Too many payment attempts. Please wait ten minutes.');
    const now = new Date().toISOString();
    const id = `NF-${now.slice(2,10).replaceAll('-','')}-${randomBytes(4).toString('hex').toUpperCase()}`;
    db().prepare('INSERT INTO orders (id,user_id,idempotency_key,fingerprint,created_at,updated_at,status,total,details) VALUES (?,?,?,?,?,?,?,?,?)').run(id,userId,key,fingerprint,now,now,'requesting',input.total,JSON.stringify({...input,email}));
    return {row: getOrder(id,userId), created: true};
  })();
}
export function updatePayment(id: string, status: OrderStatus, providerId: string | null, note: string) {
  db().transaction(() => {
    db().prepare('UPDATE orders SET provider_id=COALESCE(provider_id,?) WHERE id=?').run(providerId,id);
    db().prepare("UPDATE orders SET status=?, payment_note=?, updated_at=? WHERE id=? AND status='requesting'").run(status,note,new Date().toISOString(),id);
  })();
}
