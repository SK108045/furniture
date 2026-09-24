import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from './config';
let connection: Database.Database;
export function db() {
  if (connection) return connection;
  const path = resolve(env('DATABASE_PATH') || './data/nicoo.sqlite');
  mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  connection = new Database(path);
  connection.pragma('journal_mode = WAL');
  connection.pragma('busy_timeout = 5000');
  connection.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
      fingerprint TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      status TEXT NOT NULL, total INTEGER NOT NULL, details TEXT NOT NULL,
      provider_id TEXT, receipt TEXT UNIQUE, payment_note TEXT,
      UNIQUE(user_id, idempotency_key)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS orders_provider ON orders(provider_id) WHERE provider_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
    CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, details TEXT NOT NULL);
  `);
  return connection;
}
