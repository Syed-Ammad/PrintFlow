import db, { TZ, tzMod } from '@/lib/db';
import { admin } from '@/lib/guard';

export const GET = admin(async (_req, user) => {
  const sid = user.shop_id;
  const rows = db.prepare(`SELECT date(created_at, ${tzMod}) d, COUNT(*) orders, SUM(CASE WHEN pay_status='paid' THEN total ELSE 0 END) revenue,
    SUM(status='cancelled') cancelled FROM orders WHERE shop_id=? AND created_at >= datetime('now','-9 days') GROUP BY d`).all(sid);
  const byDay = Object.fromEntries(rows.map((r) => [r.d, r]));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + TZ * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
    const r = byDay[d] || {};
    days.push({ date: d, orders: r.orders || 0, revenue: r.revenue || 0, cancelled: r.cancelled || 0 });
  }
  const hours = Array(24).fill(0);
  db.prepare(`SELECT strftime('%H', created_at, ${tzMod}) h, COUNT(*) c FROM orders WHERE shop_id=? AND created_at >= datetime('now','-30 days') GROUP BY h`)
    .all(sid).forEach((r) => { hours[+r.h] = r.c; });
  let colour = 0, bw = 0, sheets = 0;
  db.prepare(`SELECT d.print_pages p, d.settings s FROM documents d JOIN orders o ON o.id=d.order_id WHERE o.shop_id=? AND o.status!='cancelled' AND o.created_at >= datetime('now','-30 days')`)
    .all(sid).forEach((r) => { const s = JSON.parse(r.s); const n = r.p * s.copies; sheets += n; s.color ? (colour += n) : (bw += n); });
  const today = days[6];
  return Response.json({ days, hours, colour, bw, pages: sheets, today: { ...today, avg: today.orders ? Math.round(today.revenue / Math.max(1, today.orders - today.cancelled)) : 0 } });
});
