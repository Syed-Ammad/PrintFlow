// Pure helpers shared by browser and server.
export const FLOW = {
  submitted: ['approved', 'hold', 'cancelled'], approved: ['printing', 'hold', 'cancelled'],
  hold: ['approved', 'cancelled'], printing: ['ready', 'hold', 'cancelled'],
  ready: ['collected', 'cancelled'], collected: [], cancelled: [],
};
export const LABEL = { submitted: 'New', approved: 'In queue', hold: 'On hold', printing: 'Printing', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' };
export const ACTIVE = ['submitted', 'approved', 'hold', 'printing', 'ready'];
export const WAITING = ['submitted', 'approved', 'printing'];
// SQLite gives "2026-11-21 10:00:00" (UTC). Safari needs the "T".
export const parseDb = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
export const minutesAgo = (s) => Math.max(0, Math.round((Date.now() - parseDb(s)) / 60000));
export const ago = (s) => { const m = minutesAgo(s); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`; };
