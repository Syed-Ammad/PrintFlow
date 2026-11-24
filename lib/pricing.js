export const SIZES = ['A4', 'A3', 'A5'];
export const EXTRAS = ['binding', 'stapling', 'lamination'];

export function parseRange(text, total) {
  if (!text || !text.trim()) return null;
  const set = new Set();
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/);
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < a || b > total) return null;
    for (let i = a; i <= b; i++) set.add(i);
  }
  return set.size;
}

export const defaultSettings = () => ({ size: 'A4', color: false, duplex: false, copies: 1, range: 'all', rangeText: '', orientation: 'auto', binding: false, stapling: false, lamination: false });

// Whitelist every field: never store or price anything the client sends blindly.
export function sanitizeSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  const n = Math.floor(+s.copies);
  return {
    size: SIZES.includes(s.size) ? s.size : 'A4', color: s.color === true, duplex: s.duplex === true,
    copies: Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 1,
    range: s.range === 'custom' ? 'custom' : 'all', rangeText: String(s.rangeText || '').slice(0, 100),
    orientation: ['auto', 'portrait', 'landscape'].includes(s.orientation) ? s.orientation : 'auto',
    binding: s.binding === true, stapling: s.stapling === true, lamination: s.lamination === true,
  };
}

// returns { pages, price } or { error }
export function priceDoc(prices, totalPages, raw) {
  const s = sanitizeSettings(raw);
  const pages = s.range === 'all' ? totalPages : parseRange(s.rangeText, totalPages);
  if (pages == null) return { error: 'Invalid page range. Example: 1-5, 8, 10-12' };
  const rate = prices[`${s.size.toLowerCase()}_${s.color ? 'color' : 'bw'}`];
  if (rate == null) return { error: `${s.size} ${s.color ? 'colour' : 'black & white'} is not available at this shop` };
  let cost = pages * rate * s.copies;
  if (s.duplex) cost *= 1 - (prices.double_discount || 0) / 100;
  for (const e of EXTRAS) if (s[e]) {
    if (prices[e] == null) return { error: `${e[0].toUpperCase() + e.slice(1)} is not available at this shop` };
    cost += prices[e] * s.copies;
  }
  return { pages, price: Math.round(cost) };
}
