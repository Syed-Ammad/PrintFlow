import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { hashPassword } from './password';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const TZ = Number.isFinite(+process.env.TZ_HOURS) && process.env.TZ_HOURS ? +process.env.TZ_HOURS : 5; // Pakistan = UTC+5
export const tzMod = `'${TZ >= 0 ? '+' : ''}${TZ} hours'`;

function cleanupWith(d) {
  try {
    d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    // Privacy: delete customer files when the order is finished, or after the shop's retention period.
    const rows = d.prepare(`SELECT d.id, d.stored FROM documents d JOIN orders o ON o.id=d.order_id JOIN shops s ON s.id=o.shop_id
      WHERE d.deleted=0 AND (o.status IN ('collected','cancelled') OR o.created_at < datetime('now','-' || s.retention_hours || ' hours'))`).all();
    for (const r of rows) {
      fs.rmSync(path.join(UPLOAD_DIR, r.stored), { force: true });
      d.prepare('UPDATE documents SET deleted=1 WHERE id=?').run(r.id);
    }
  } catch (e) { console.error('cleanup failed', e); }
}

function init() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const d = new Database(path.join(DATA_DIR, 'printflow.db'));
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.exec(`
    CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, address TEXT, hours TEXT,
      accepting INTEGER DEFAULT 1, minutes_per_order INTEGER DEFAULT 3, retention_hours INTEGER DEFAULT 48);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, shop_id INTEGER, email TEXT UNIQUE, name TEXT, role TEXT DEFAULT 'owner', pw_hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER, expires_at INTEGER);
    CREATE TABLE IF NOT EXISTS prices (shop_id INTEGER, key TEXT, label TEXT, value REAL, enabled INTEGER DEFAULT 1, PRIMARY KEY(shop_id,key));
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT UNIQUE, track_token TEXT, shop_id INTEGER, phone TEXT,
      status TEXT DEFAULT 'submitted', pay_status TEXT DEFAULT 'pending', total REAL, urgent INTEGER DEFAULT 0, note TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, name TEXT, stored TEXT, pages INTEGER,
      print_pages INTEGER, settings TEXT, price REAL, deleted INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id INTEGER, user_id INTEGER, action TEXT, detail TEXT, ip TEXT,
      created_at TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id, status);
  `);
  if (!d.prepare('SELECT 1 FROM shops').get()) {
    d.prepare('INSERT INTO shops (slug,name,address,hours) VALUES (?,?,?,?)').run('campus-print-point', 'Campus Print Point', 'Near Main Gate, Islamabad', '8:00 AM - 9:00 PM');
    const ins = d.prepare('INSERT INTO prices (shop_id,key,label,value) VALUES (1,?,?,?)');
    [['a4_bw', 'A4 Black & White (per page)', 10], ['a4_color', 'A4 Colour (per page)', 30], ['a3_bw', 'A3 Black & White (per page)', 25],
      ['a3_color', 'A3 Colour (per page)', 60], ['a5_bw', 'A5 Black & White (per page)', 6], ['a5_color', 'A5 Colour (per page)', 20],
      ['double_discount', 'Double-sided discount (%)', 10], ['binding', 'Spiral binding (per copy)', 100],
      ['stapling', 'Stapling (per copy)', 10], ['lamination', 'Lamination (per copy)', 50]].forEach((p) => ins.run(...p));
    const fromEnv = !!process.env.DASH_PASSWORD;
    const pw = process.env.DASH_PASSWORD || crypto.randomBytes(7).toString('base64url');
    d.prepare('INSERT INTO users (shop_id,email,name,pw_hash) VALUES (1,?,?,?)').run('owner@printflow.local', 'Shop Owner', hashPassword(pw));
    if (!fromEnv) console.log(`\n==========================================\n  FIRST RUN: shopkeeper login\n  Email:    owner@printflow.local\n  Password: ${pw}\n  (shown once - change it in Settings)\n==========================================\n`);
  }
  cleanupWith(d);
  setInterval(() => cleanupWith(d), 10 * 60 * 1000).unref?.();
  return d;
}

const db = globalThis.__pfdb || (globalThis.__pfdb = init());
export default db;
export const cleanup = () => cleanupWith(db);
export const pricesFor = (shopId) => db.prepare('SELECT key,label,value FROM prices WHERE shop_id=? AND enabled=1').all(shopId);
export const priceMap = (shopId) => Object.fromEntries(pricesFor(shopId).map((r) => [r.key, r.value]));
