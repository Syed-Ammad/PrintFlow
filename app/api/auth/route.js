import db from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password';
import { startSession, endSession, currentUser, clientIp, sameOrigin } from '@/lib/auth';
import { limited, clearLimit } from '@/lib/limit';

const DUMMY = hashPassword('dummy-password'); // so unknown emails take as long as known ones

export async function GET() {
  const u = currentUser();
  return Response.json(u ? { user: { name: u.name, email: u.email, role: u.role } } : { user: null });
}
export async function POST(req) {
  if (!sameOrigin(req)) return Response.json({ error: 'Blocked: bad origin' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase().slice(0, 100);
  const kIp = `login:ip:${clientIp(req)}`, kMail = `login:mail:${email}`;
  if (limited(kIp, 15, 15 * 60 * 1000) || limited(kMail, 6, 15 * 60 * 1000))
    return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const ok = verifyPassword(String(b.password || '').slice(0, 200), u ? u.pw_hash : DUMMY) && !!u;
  if (!ok) return Response.json({ error: 'Wrong email or password' }, { status: 401 });
  clearLimit(kMail);
  startSession(u.id);
  db.prepare('INSERT INTO audit (shop_id,user_id,action,detail,ip) VALUES (?,?,?,?,?)').run(u.shop_id, u.id, 'login', '', clientIp(req));
  return Response.json({ ok: true });
}
export async function DELETE(req) {
  if (!sameOrigin(req)) return Response.json({ error: 'Blocked: bad origin' }, { status: 403 });
  endSession();
  return Response.json({ ok: true });
}
