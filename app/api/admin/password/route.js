import db from '@/lib/db';
import { admin } from '@/lib/guard';
import { audit, startSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { limited } from '@/lib/limit';

export const POST = admin(async (req, user) => {
  if (limited(`pw:${user.id}`, 5, 15 * 60 * 1000)) return Response.json({ error: 'Too many attempts. Try later.' }, { status: 429 });
  const { current, next } = await req.json().catch(() => ({}));
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  if (!verifyPassword(String(current || ''), u.pw_hash)) return Response.json({ error: 'Current password is wrong' }, { status: 400 });
  if (typeof next !== 'string' || next.length < 8 || next.length > 100) return Response.json({ error: 'New password must be 8-100 characters' }, { status: 400 });
  db.prepare('UPDATE users SET pw_hash=? WHERE id=?').run(hashPassword(next), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); // log out every other device
  startSession(user.id);
  audit(user, 'password', 'Password changed', req);
  return Response.json({ ok: true });
});
