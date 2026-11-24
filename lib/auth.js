import crypto from 'crypto';
import { cookies } from 'next/headers';
import db from './db';

const COOKIE = 'pf_session', TTL = 12 * 3600 * 1000;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Random session token in an HttpOnly cookie; only its hash is stored, so a leaked database cannot be used to log in.
export function startSession(userId) {
  const t = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').run(sha(t), userId, Date.now() + TTL);
  cookies().set(COOKIE, t, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === '1', path: '/', maxAge: TTL / 1000 });
}
export function endSession() {
  const t = cookies().get(COOKIE)?.value;
  if (t) db.prepare('DELETE FROM sessions WHERE id=?').run(sha(t));
  cookies().delete(COOKIE);
}
export function currentUser() {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  return db.prepare('SELECT u.id,u.shop_id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?').get(sha(t), Date.now()) || null;
}
export const clientIp = (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
// CSRF defence (on top of SameSite=Strict): state-changing requests must come from our own site.
export function sameOrigin(req) {
  const o = req.headers.get('origin');
  try { return !!o && new URL(o).host === req.headers.get('host'); } catch { return false; }
}
export function audit(user, action, detail, req) {
  db.prepare('INSERT INTO audit (shop_id,user_id,action,detail,ip) VALUES (?,?,?,?,?)').run(user.shop_id, user.id, action, String(detail || '').slice(0, 200), req ? clientIp(req) : '');
}
