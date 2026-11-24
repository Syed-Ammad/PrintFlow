import db from '@/lib/db';
import { admin } from '@/lib/guard';
import { audit } from '@/lib/auth';
export const GET = admin(async (_req, user) => Response.json(db.prepare('SELECT key,label,value,enabled FROM prices WHERE shop_id=?').all(user.shop_id)));
export const PUT = admin(async (req, user) => {
  const rows = await req.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'Bad request' }, { status: 400 });
  const up = db.prepare('UPDATE prices SET value=?, enabled=? WHERE shop_id=? AND key=?');
  db.transaction(() => rows.forEach((r) => {
    const max = r.key === 'double_discount' ? 100 : 100000;
    up.run(Math.min(max, Math.max(0, Number(r.value) || 0)), r.enabled ? 1 : 0, user.shop_id, String(r.key));
  }))();
  audit(user, 'prices', 'Price list updated', req);
  return Response.json({ ok: true });
});
