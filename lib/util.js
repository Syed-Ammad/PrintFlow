import crypto from 'crypto';
export function detectType(buf) {
  if (buf.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'pdf';
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}
export const cleanName = (n) => String(n).replace(/[^\w.\- ()]/g, '_').slice(0, 80) || 'file';
export function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export const clampInt = (v, lo, hi, d) => { const n = Math.floor(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
