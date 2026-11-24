import db, { pricesFor } from '@/lib/db';
import { WAITING } from '@/lib/status';
export async function GET(_req, { params }) {
  const s = db.prepare('SELECT * FROM shops WHERE slug=?').get(params.slug);
  if (!s) return Response.json({ error: 'Shop not found' }, { status: 404 });
  const q = WAITING.map(() => '?').join(',');
  const pending = db.prepare(`SELECT COUNT(*) c FROM orders WHERE shop_id=? AND status IN (${q})`).get(s.id, ...WAITING).c;
  return Response.json({
    shop: { name: s.name, address: s.address, hours: s.hours, accepting: !!s.accepting },
    prices: pricesFor(s.id), waitMinutes: 2 + pending * s.minutes_per_order,
  });
}
