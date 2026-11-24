import fs from 'fs';
import path from 'path';
import db, { UPLOAD_DIR } from '@/lib/db';
import { admin } from '@/lib/guard';
import { audit } from '@/lib/auth';
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };

export const GET = admin(async (req, user, { params }) => {
  const d = db.prepare('SELECT d.*, o.order_no FROM documents d JOIN orders o ON o.id=d.order_id WHERE d.id=? AND o.shop_id=? AND d.deleted=0').get(+params.id, user.shop_id);
  const p = d && path.join(UPLOAD_DIR, path.basename(d.stored));
  if (!d || !fs.existsSync(p)) return new Response('File not found (it may have been deleted)', { status: 404 });
  audit(user, 'file_open', `${d.order_no}: ${d.name}`, req);
  const ext = d.stored.split('.').pop();
  return new Response(fs.readFileSync(p), { headers: {
    'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(d.name)}`, 'Cache-Control': 'private, no-store',
  } });
});
