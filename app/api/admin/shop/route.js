import db from '@/lib/db';
import { admin } from '@/lib/guard';
import { audit } from '@/lib/auth';
import { clampInt } from '@/lib/util';

export const GET = admin(async (_req, user) => {
  const s = db.prepare('SELECT slug,name,address,hours,accepting,minutes_per_order,retention_hours FROM shops WHERE id=?').get(user.shop_id);
  const log = db.prepare('SELECT action,detail,created_at FROM audit WHERE shop_id=? ORDER BY id DESC LIMIT 30').all(user.shop_id);
  return Response.json({ shop: s, audit: log, user: { name: user.name, email: user.email } });
});
export const PUT = admin(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const s = db.prepare('SELECT * FROM shops WHERE id=?').get(user.shop_id);
  const t = (v, d, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d);
  db.prepare('UPDATE shops SET name=?,address=?,hours=?,accepting=?,minutes_per_order=?,retention_hours=? WHERE id=?').run(
    t(b.name, s.name, 60), t(b.address, s.address, 120), t(b.hours, s.hours, 60),
    b.accepting === undefined ? s.accepting : b.accepting ? 1 : 0,
    clampInt(b.minutes_per_order, 1, 60, s.minutes_per_order), clampInt(b.retention_hours, 1, 720, s.retention_hours), s.id);
  audit(user, 'shop', b.accepting !== undefined && Object.keys(b).length === 1 ? `accepting=${!!b.accepting}` : 'Shop settings updated', req);
  return Response.json({ ok: true });
});
