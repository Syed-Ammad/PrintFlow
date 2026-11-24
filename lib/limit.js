// Simple in-memory rate limiter (fine for one local server; use Redis if you run several servers).
const m = globalThis.__rl || (globalThis.__rl = new Map());
export function limited(key, max, windowMs) {
  const now = Date.now();
  let e = m.get(key);
  if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; m.set(key, e); }
  e.n++;
  if (m.size > 5000) for (const [k, v] of m) if (v.reset < now) m.delete(k);
  return e.n > max;
}
export const clearLimit = (key) => m.delete(key);
