import fs from 'fs';
import path from 'path';
import db, { UPLOAD_DIR, cleanup } from '@/lib/db';
import { admin } from '@/lib/guard';
import { audit } from '@/lib/auth';
import { FLOW } from '@/lib/status';

export const GET = admin(async (_req, user) => {
  const orders = db.prepare('SELECT id,order_no,phone,status,pay_status,total,urgent,note,created_at FROM orders WHERE shop_id=? ORDER BY id DESC LIMIT 200').all(user.shop_id);
  const getDocs = db.prepare('SELECT id,name,pages,print_pages,settings,price,stored,deleted FROM documents WHERE order_id=?');
  for (const o of orders) {
    o.docs = getDocs.all(o.id).map(({ stored, deleted, settings, ...d }) => ({ ...d, settings: JSON.parse(settings), available: !deleted && fs.existsSync(path.join(UPLOAD_DIR, stored)) }));
  }
  const shop = db.prepare('SELECT name,accepting FROM shops WHERE id=?').get(user.shop_id);
  return Response.json({ orders, shop });
});

export const PATCH = admin(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND shop_id=?').get(+b.id, user.shop_id); // scoped to this shop
  if (!o) return Response.json({ error: 'Order not found' }, { status: 404 });
  const err = (m) => Response.json({ error: m }, { status: 400 });

  const pay = b.pay ?? o.pay_status, status = b.status ?? o.status;
  if (!['pending', 'paid', 'refunded'].includes(pay)) return err('Bad payment status');
  if (b.pay === 'refunded' && o.pay_status !== 'paid') return err('Only paid orders can be refunded');
  if (b.pay === 'paid' && o.status === 'cancelled') return err('Order is cancelled');
  if (b.status && !FLOW[o.status].includes(b.status)) return err(`Cannot move an order from "${o.status}" to "${b.status}"`);
  if (status === 'collected' && pay !== 'paid') return err('Receive payment before handing over');
  const note = status === 'cancelled' && b.note ? String(b.note).trim().slice(0, 120) : o.note;

  db.prepare("UPDATE orders SET status=?, pay_status=?, note=?, urgent=?, updated_at=datetime('now') WHERE id=?")
    .run(status, pay, note, b.urgent === undefined ? o.urgent : b.urgent ? 1 : 0, o.id);
  if (status !== o.status) audit(user, 'status', `${o.order_no}: ${o.status} -> ${status}${note && status === 'cancelled' ? ` (${note})` : ''}`, req);
  if (pay !== o.pay_status) audit(user, 'payment', `${o.order_no}: ${o.pay_status} -> ${pay}`, req);
  if (b.urgent !== undefined && !!b.urgent !== !!o.urgent) audit(user, 'priority', `${o.order_no}: urgent=${!!b.urgent}`, req);
  if (status === 'collected' || status === 'cancelled') cleanup(); // delete customer files now
  return Response.json({ ok: true });
});
