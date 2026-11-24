import db from '@/lib/db';
import { WAITING } from '@/lib/status';
import { safeEq } from '@/lib/util';
import { limited } from '@/lib/limit';
import { clientIp } from '@/lib/auth';

// Order numbers are guessable (sequential), so tracking also needs the secret token from the customer's link.
export async function GET(req, { params }) {
  if (limited(`track:${clientIp(req)}`, 120, 60 * 1000)) return Response.json({ error: 'Slow down' }, { status: 429 });
  const t = new URL(req.url).searchParams.get('t') || '';
  const o = db.prepare('SELECT o.*, s.name shop_name, s.minutes_per_order mpo FROM orders o JOIN shops s ON s.id=o.shop_id WHERE o.order_no=?').get(params.no);
  if (!o || !o.track_token || !safeEq(t, o.track_token)) return Response.json({ error: 'Order not found' }, { status: 404 });
  const q = WAITING.map(() => '?').join(',');
  const ahead = WAITING.includes(o.status) ? db.prepare(`SELECT COUNT(*) c FROM orders WHERE shop_id=? AND id<? AND status IN (${q})`).get(o.shop_id, o.id, ...WAITING).c : 0;
  const docs = db.prepare('SELECT name,print_pages pages,price FROM documents WHERE order_id=?').all(o.id);
  return Response.json({
    order: { order_no: o.order_no, status: o.status, pay_status: o.pay_status, total: o.total, shop_name: o.shop_name, note: o.note },
    ahead, eta: WAITING.includes(o.status) ? (ahead + 1) * o.mpo : 0, docs,
  });
}
