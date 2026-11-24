import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import db, { UPLOAD_DIR, priceMap } from '@/lib/db';
import { priceDoc, sanitizeSettings } from '@/lib/pricing';
import { detectType, cleanName } from '@/lib/util';
import { limited } from '@/lib/limit';
import { clientIp, sameOrigin } from '@/lib/auth';

const MAX_FILE = 25 * 1024 * 1024, MAX_BODY = 80 * 1024 * 1024;
const bad = (error, status = 400) => Response.json({ error }, { status });

export async function POST(req) {
  try {
    if (!sameOrigin(req)) return bad('Blocked: bad origin', 403);
    if (limited(`order:${clientIp(req)}`, 20, 10 * 60 * 1000)) return bad('Too many orders. Please wait a few minutes.', 429);
    if ((+req.headers.get('content-length') || 0) > MAX_BODY) return bad('Upload is too large', 413);

    const form = await req.formData();
    let meta; try { meta = JSON.parse(form.get('meta')); } catch { return bad('Invalid request'); }
    const files = form.getAll('files');
    const shop = db.prepare('SELECT * FROM shops WHERE slug=?').get(String(meta.slug || ''));
    if (!shop) return bad('Shop not found', 404);
    if (!shop.accepting) return bad('This shop is not accepting orders right now', 403);
    if (!files.length || files.length > 10 || !Array.isArray(meta.settings) || files.length !== meta.settings.length) return bad('Upload 1 to 10 files');
    const phone = String(meta.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    const prices = priceMap(shop.id);

    const docs = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (typeof f === 'string') return bad('Invalid file');
      const name = cleanName(f.name);
      if (f.size > MAX_FILE) return bad(`${name}: file too large (max 25 MB)`);
      const buf = Buffer.from(await f.arrayBuffer());
      const type = detectType(buf); // check real file content, not the file name
      if (!type) return bad(`${name}: only PDF, JPG and PNG files are allowed`);
      let pages = 1;
      if (type === 'pdf') {
        try { pages = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount(); }
        catch { return bad(`${name}: this PDF is damaged or unreadable`); }
        if (pages > 1000) return bad(`${name}: too many pages (max 1000)`);
      }
      const settings = sanitizeSettings(meta.settings[i]);
      const r = priceDoc(prices, pages, settings); // server price is the only price that counts
      if (r.error) return bad(`${name}: ${r.error}`);
      docs.push({ name, buf, type, pages, settings, ...r });
    }

    const total = docs.reduce((s, d) => s + d.price, 0);
    const token = crypto.randomBytes(9).toString('base64url');
    const orderNo = db.transaction(() => {
      const o = db.prepare('INSERT INTO orders (shop_id,phone,total,track_token) VALUES (?,?,?,?)').run(shop.id, phone, total, token);
      const no = `PRINT-${new Date().getFullYear()}-${String(o.lastInsertRowid).padStart(5, '0')}`;
      db.prepare('UPDATE orders SET order_no=? WHERE id=?').run(no, o.lastInsertRowid);
      for (const d of docs) {
        const stored = crypto.randomUUID() + '.' + d.type;
        fs.writeFileSync(path.join(UPLOAD_DIR, stored), d.buf);
        db.prepare('INSERT INTO documents (order_id,name,stored,pages,print_pages,settings,price) VALUES (?,?,?,?,?,?,?)')
          .run(o.lastInsertRowid, d.name, stored, d.pages, d.pages, JSON.stringify(d.settings), d.price);
      }
      return no;
    })();
    return Response.json({ orderNo, token, total });
  } catch (e) { console.error(e); return bad('Could not place order', 500); }
}
