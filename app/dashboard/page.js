'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLOW, LABEL, ACTIVE, ago, minutesAgo, parseDb } from '@/lib/status';
import { priceDoc } from '@/lib/pricing';

async function call(url, method = 'GET', body) {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ...d, ok: r.ok, code: r.status };
  } catch { return { ok: false, code: 0, error: 'No connection to the server' }; }
}
const COLOR = { submitted: 'bg-amber-100 text-amber-800', approved: 'bg-blue-100 text-blue-700', hold: 'bg-orange-100 text-orange-700', printing: 'bg-indigo-100 text-indigo-700', ready: 'bg-green-100 text-green-700', collected: 'bg-slate-100 text-slate-600', cancelled: 'bg-red-100 text-red-700' };
const PAY = { pending: ['Cash pending', 'bg-amber-100 text-amber-800'], paid: ['Paid', 'bg-green-100 text-green-700'], refunded: ['Refunded', 'bg-slate-100 text-slate-600'] };
const NAV = [['orders', '🖨️', 'Orders'], ['reports', '📊', 'Reports'], ['pricing', '💰', 'Pricing'], ['settings', '⚙️', 'Shop']];

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="slide-up bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex justify-between items-center"><h2 className="font-bold text-lg">{title}</h2><button aria-label="Close" className="w-10 h-10" onClick={onClose}>✕</button></div>{children}
      </div>
    </div>
  );
}

function Login({ onOk }) {
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await call('/api/auth', 'POST', f); setBusy(false);
    r.ok ? onOk() : setErr(r.error || 'Login failed');
  }
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={go} className="card w-full max-w-sm space-y-3 !p-6">
        <h1 className="text-2xl font-bold text-brand">PrintFlow</h1><p className="text-mute text-sm -mt-2">Shop login</p>
        <input className="inp" type="email" autoComplete="username" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <div className="relative"><input className="inp pr-16" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <button type="button" className="absolute right-2 top-2 min-h-8 px-2 text-sm text-brand" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
        {err && <p role="alert" className="text-red-600 text-sm">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function OrderCard({ o, act, onCancel }) {
  const [open, setOpen] = useState(false);
  const wait = minutesAgo(o.created_at), live = ['submitted', 'approved'].includes(o.status);
  const sheets = o.docs.reduce((s, d) => s + d.print_pages * d.settings.copies, 0);
  const next = o.status === 'ready'
    ? (o.pay_status === 'paid' ? ['Hand over to customer', { status: 'collected' }] : [`Receive Rs. ${o.total} & hand over`, { status: 'collected', pay: 'paid' }])
    : { submitted: ['Approve order', { status: 'approved' }], approved: ['Start printing', { status: 'printing' }], printing: ['Mark ready', { status: 'ready' }], hold: ['Resume', { status: 'approved' }] }[o.status];
  return (
    <article className={`card space-y-3 slide-up ${o.urgent && ACTIVE.includes(o.status) ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}>
      <button className="w-full text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0"><p className="font-bold">{o.urgent ? '⭐ ' : ''}{o.order_no}</p><p className="text-sm text-mute">{o.docs.length} file{o.docs.length > 1 && 's'} · {sheets} pages · {ago(o.created_at)}</p></div>
          <div className="text-right shrink-0"><p className="font-bold">Rs. {o.total}</p><span className={`pill ${PAY[o.pay_status][1]}`}>{PAY[o.pay_status][0]}</span></div>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap"><span className={`pill ${COLOR[o.status]}`}>{LABEL[o.status]}</span>
          {live && wait >= 15 && <span className="pill bg-red-100 text-red-700">Waiting {wait} min</span>}
          {o.phone && <span className="text-xs text-mute">{o.phone}</span>}<span className="ml-auto text-mute text-sm">{open ? '▲' : '▼'}</span></div>
      </button>
      {open && <ul className="text-sm space-y-2 border-t border-line pt-2">
        {o.docs.map((d) => (
          <li key={d.id} className="flex justify-between gap-3 items-center">
            <span className="min-w-0"><b className="block truncate">{d.name}</b>
              <span className="text-mute">{d.print_pages} pg · {d.settings.size} · {d.settings.color ? 'Colour' : 'B&W'} · {d.settings.duplex ? 'Double' : 'Single'} · {d.settings.copies}×{d.settings.range === 'custom' ? ` · pages ${d.settings.rangeText}` : ''}{['binding', 'stapling', 'lamination'].filter((k) => d.settings[k]).map((k) => ` · ${k}`)}</span></span>
            {d.available ? <a className="btn2 btn-sm shrink-0 flex items-center" href={`/api/admin/files/${d.id}`} target="_blank" rel="noreferrer">Open</a> : <span className="text-mute shrink-0 text-xs">Deleted</span>}
          </li>))}
        {o.note && <li className="text-red-700">Reason: {o.note}</li>}
      </ul>}
      <div className="flex gap-2 flex-wrap">
        {next && <button className="btn flex-1 min-w-[10rem]" onClick={() => act(o, next[1])}>{next[0]}</button>}
        {open && ACTIVE.includes(o.status) && <>
          {o.pay_status === 'pending' && <button className="btn2 btn-sm" onClick={() => act(o, { pay: 'paid' })}>Cash received</button>}
          {FLOW[o.status].includes('hold') && <button className="btn2 btn-sm" onClick={() => act(o, { status: 'hold' })}>Hold</button>}
          <button className="btn2 btn-sm" onClick={() => act(o, { urgent: !o.urgent })}>{o.urgent ? 'Remove priority' : '⭐ Urgent'}</button>
          <button className="btn2 btn-sm text-red-600" onClick={() => onCancel(o)}>Cancel</button></>}
        {open && o.pay_status === 'paid' && o.status === 'cancelled' && <button className="btn2 btn-sm" onClick={() => act(o, { pay: 'refunded' })}>Mark refunded</button>}
      </div>
    </article>
  );
}

function Bars({ data, fmt = (v) => v, labelEvery = 1 }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex items-end gap-1 h-36">
      {data.map((d, i) => (
        <div key={d.k + i} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${d.k}: ${fmt(d.v)}`}>
          <div className="w-full bg-brand rounded-t transition-all" style={{ height: `${(d.v / max) * 85}%`, minHeight: d.v ? 3 : 0 }} />
          <span className="text-[10px] text-mute h-3">{i % labelEvery === 0 ? d.k : ''}</span>
        </div>))}
    </div>
  );
}

function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { call('/api/admin/reports').then(setR); }, []);
  if (!r) return <p className="text-mute">Loading reports…</p>;
  const total = r.colour + r.bw || 1;
  const peak = r.hours.indexOf(Math.max(...r.hours));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Orders today', r.today.orders], ['Cash received today', `Rs. ${r.today.revenue}`], ['Average order', `Rs. ${r.today.avg}`], ['Cancelled today', r.today.cancelled]].map(([l, v]) => <div key={l} className="card"><p className="text-sm text-mute">{l}</p><p className="text-2xl font-bold">{v}</p></div>)}
      </div>
      <div className="card"><h3 className="font-semibold mb-3">Cash received, last 7 days</h3><Bars data={r.days.map((d) => ({ k: d.date.slice(5), v: d.revenue }))} fmt={(v) => `Rs. ${v}`} /></div>
      <div className="card"><h3 className="font-semibold mb-1">Busiest hours (last 30 days)</h3>
        <p className="text-sm text-mute mb-3">{Math.max(...r.hours) ? `Peak time: ${peak}:00 to ${peak + 1}:00` : 'No orders yet'}</p><Bars data={r.hours.map((v, h) => ({ k: h, v }))} labelEvery={3} /></div>
      <div className="card space-y-2"><h3 className="font-semibold">Pages printed (last 30 days): {r.pages}</h3>
        <div className="h-4 rounded-full overflow-hidden flex bg-line"><div className="bg-slate-700" style={{ width: `${(r.bw / total) * 100}%` }} /><div className="bg-brand" style={{ width: `${(r.colour / total) * 100}%` }} /></div>
        <p className="text-sm text-mute">B&W {r.bw} · Colour {r.colour}</p></div>
    </div>
  );
}

function Pricing({ toast }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { call('/api/admin/prices').then((d) => setRows(Array.isArray(d) ? d : [])); }, []);
  if (!rows) return <p className="text-mute">Loading…</p>;
  const map = Object.fromEntries(rows.filter((r) => r.enabled).map((r) => [r.key, +r.value]));
  const ex = priceDoc(map, 20, { size: 'A4', color: false, duplex: true, copies: 1, range: 'all' });
  const set = (i, p) => setRows((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  async function save() { const r = await call('/api/admin/prices', 'PUT', rows); toast(r.ok ? 'Prices saved ✓' : r.error || 'Could not save', !r.ok); }
  return (
    <div className="space-y-4 max-w-xl">
      <div className="card space-y-3">
        {rows.map((p, i) => (
          <div key={p.key} className="flex items-center gap-3">
            <span className={`flex-1 text-sm ${p.enabled ? '' : 'text-mute line-through'}`}>{p.label}</span>
            <input aria-label={p.label} className="inp !w-24 !min-h-11 text-right" type="number" inputMode="decimal" min="0" value={p.value} onChange={(e) => set(i, { value: e.target.value })} />
            <button role="switch" aria-checked={!!p.enabled} aria-label={`${p.label} available`} onClick={() => set(i, { enabled: p.enabled ? 0 : 1 })} className={`w-12 h-7 rounded-full p-0.5 transition ${p.enabled ? 'bg-brand' : 'bg-line'}`}><span className={`block w-6 h-6 rounded-full bg-white transition ${p.enabled ? 'translate-x-5' : ''}`} /></button>
          </div>))}
      </div>
      <div className="card text-sm bg-blue-50 border-blue-200">Example: 20 pages, A4, B&W, double-sided = <b>{ex.error ? 'n/a' : `Rs. ${ex.price}`}</b></div>
      <button className="btn w-full md:w-auto" onClick={save}>Save changes</button>
    </div>
  );
}

function Settings({ toast, onSignOut }) {
  const [d, setD] = useState(null); const [pw, setPw] = useState({ current: '', next: '' });
  const load = () => call('/api/admin/shop').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <p className="text-mute">Loading…</p>;
  const s = d.shop, set = (p) => setD({ ...d, shop: { ...s, ...p } });
  const url = `${location.origin}/s/${s.slug}`;
  async function save() { const r = await call('/api/admin/shop', 'PUT', s); toast(r.ok ? 'Shop saved ✓' : r.error, !r.ok); load(); }
  async function changePw() { const r = await call('/api/admin/password', 'POST', pw); toast(r.ok ? 'Password changed ✓' : r.error, !r.ok); if (r.ok) setPw({ current: '', next: '' }); }
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div className="card space-y-3"><h3 className="font-semibold">Shop details</h3>
          {[['name', 'Shop name'], ['address', 'Address'], ['hours', 'Opening hours']].map(([k, l]) => <div key={k}><label className="lbl block" htmlFor={k}>{l}</label><input id={k} className="inp" value={s[k]} onChange={(e) => set({ [k]: e.target.value })} /></div>)}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl block" htmlFor="mpo">Minutes per order</label><input id="mpo" className="inp" type="number" min="1" max="60" value={s.minutes_per_order} onChange={(e) => set({ minutes_per_order: e.target.value })} /></div>
            <div><label className="lbl block" htmlFor="ret">Delete files after (hours)</label><input id="ret" className="inp" type="number" min="1" max="720" value={s.retention_hours} onChange={(e) => set({ retention_hours: e.target.value })} /></div></div>
          <button className="btn w-full" onClick={save}>Save shop</button></div>
        <div className="card space-y-3"><h3 className="font-semibold">Change password</h3>
          <input className="inp" type="password" autoComplete="current-password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <input className="inp" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <button className="btn2 w-full" onClick={changePw}>Update password</button>
          <p className="text-xs text-mute">Signed in as {d.user.email}. Changing the password signs out all other devices.</p>
          <button className="btn2 w-full text-red-600" onClick={onSignOut}>Sign out</button></div>
      </div>
      <div className="space-y-4">
        <div className="card text-center space-y-2 poster"><h3 className="font-bold text-lg">{s.name}</h3>
          <img src={`/api/qr?slug=${s.slug}`} alt="QR code for your shop" className="mx-auto w-56 h-56" />
          <p className="font-semibold">Skip the queue. Scan. Upload. Pay. Print.</p><p className="text-xs text-mute break-all">{url}</p></div>
        <div className="flex gap-2"><button className="btn2 flex-1" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied ✓'); }}>Copy link</button><button className="btn flex-1" onClick={() => window.print()}>Print poster</button></div>
        <div className="card"><h3 className="font-semibold mb-2">Activity log</h3>
          <ul className="text-sm space-y-1.5 max-h-72 overflow-y-auto">{d.audit.map((a, i) => <li key={i} className="flex justify-between gap-2"><span className="min-w-0"><b>{a.action}</b> <span className="text-mute break-words">{a.detail}</span></span><span className="text-xs text-mute shrink-0">{parseDb(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(null);
  const [data, setData] = useState({ orders: [], shop: { name: '', accepting: 1 } });
  const [view, setView] = useState('orders');
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [reason, setReason] = useState('');
  const lastId = useRef(null); const audio = useRef(null);

  const toast = (m, bad) => { setToastMsg({ m, bad }); setTimeout(() => setToastMsg(null), 2600); };
  const beep = () => {
    try { const a = audio.current; if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.15; o.start(); o.stop(a.currentTime + 0.18); } catch {}
  };
  useEffect(() => { const f = () => { audio.current ||= new (window.AudioContext || window.webkitAudioContext)(); }; window.addEventListener('pointerdown', f, { once: true }); return () => window.removeEventListener('pointerdown', f); }, []);

  const load = useCallback(async () => {
    const r = await call('/api/admin/orders');
    if (r.code === 401) return setAuthed(false);
    if (!r.ok) return;
    setAuthed(true); setData(r);
    const max = r.orders.reduce((m, o) => Math.max(m, o.id), 0);
    if (lastId.current !== null && max > lastId.current) { beep(); try { navigator.vibrate?.([120, 60, 120]); } catch {} toast('New order received 🖨️'); }
    lastId.current = max;
  }, []);
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 4000); return () => clearInterval(t); }, [load]);

  const newCount = data.orders.filter((o) => o.status === 'submitted').length;
  useEffect(() => { document.title = newCount ? `(${newCount}) New orders · PrintFlow` : 'PrintFlow Dashboard'; }, [newCount]);

  async function act(o, body) {
    const r = await call('/api/admin/orders', 'PATCH', { id: o.id, ...body });
    if (!r.ok) toast(r.error || 'Action failed', true); else if (body.status) { try { navigator.vibrate?.(15); } catch {} toast(`${o.order_no}: ${LABEL[body.status]} ✓`); }
    load();
  }
  async function toggleAccepting() {
    const accepting = !data.shop.accepting;
    setData({ ...data, shop: { ...data.shop, accepting: accepting ? 1 : 0 } });
    const r = await call('/api/admin/shop', 'PUT', { accepting });
    toast(accepting ? 'Now accepting orders' : 'Orders paused: customers see "Closed"', !r.ok); load();
  }
  async function signOut() { await call('/api/auth', 'DELETE'); setAuthed(false); }

  if (authed === null) return <p className="p-6 text-mute">Loading…</p>;
  if (!authed) return <Login onOk={load} />;

  const orders = data.orders;
  const count = (f) => orders.filter(f).length;
  const FILTERS = [['active', 'Active', (o) => ACTIVE.includes(o.status)], ['submitted', 'New', (o) => o.status === 'submitted'], ['printing', 'Printing', (o) => ['approved', 'printing'].includes(o.status)],
    ['ready', 'Ready', (o) => o.status === 'ready'], ['hold', 'On hold', (o) => o.status === 'hold'], ['done', 'Done', (o) => ['collected', 'cancelled'].includes(o.status)], ['all', 'All', () => true]];
  const fn = FILTERS.find((f) => f[0] === filter)[2];
  const query = q.trim().toLowerCase();
  const shown = orders.filter(fn).filter((o) => !query || o.order_no.toLowerCase().includes(query) || (o.phone || '').includes(query));
  const queueView = ['active', 'submitted', 'printing', 'ready', 'hold'].includes(filter);
  shown.sort((a, b) => (queueView ? (b.urgent - a.urgent) || (a.id - b.id) : b.id - a.id));
  const todayCash = orders.filter((o) => o.pay_status === 'paid' && parseDb(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + o.total, 0);

  return (
    <div className="min-h-screen md:pl-52">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-52 flex-col bg-white border-r border-line p-3 gap-1 no-print">
        <p className="text-xl font-bold text-brand px-3 py-3">PrintFlow</p>
        {NAV.map(([k, icon, l]) => <button key={k} onClick={() => setView(k)} className={`flex items-center gap-3 min-h-11 px-3 rounded-xl text-left font-medium ${view === k ? 'bg-blue-50 text-brand' : 'hover:bg-bg'}`}><span>{icon}</span>{l}{k === 'orders' && newCount > 0 && <span className="ml-auto pill bg-red-600 text-white">{newCount}</span>}</button>)}
      </aside>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-line px-4 h-14 flex items-center justify-between gap-3 no-print">
        <h1 className="font-bold truncate">{data.shop.name || 'Dashboard'}</h1>
        <button role="switch" aria-checked={!!data.shop.accepting} onClick={toggleAccepting} className="flex items-center gap-2 text-sm font-medium min-h-10">
          <span className={data.shop.accepting ? 'text-green-700' : 'text-red-700'}>{data.shop.accepting ? 'Accepting orders' : 'Paused'}</span>
          <span className={`w-12 h-7 rounded-full p-0.5 transition ${data.shop.accepting ? 'bg-green-600' : 'bg-line'}`}><span className={`block w-6 h-6 rounded-full bg-white transition ${data.shop.accepting ? 'translate-x-5' : ''}`} /></span></button>
      </header>

      <main className="p-4 pb-28 md:pb-8 max-w-5xl mx-auto space-y-4">
        {view === 'orders' && <>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 md:grid md:grid-cols-4 md:mx-0 md:px-0">
            {[['New', count((o) => o.status === 'submitted'), 'text-amber-700'], ['Printing', count((o) => ['approved', 'printing'].includes(o.status)), 'text-indigo-700'], ['Ready', count((o) => o.status === 'ready'), 'text-green-700'], ['Cash today', `Rs. ${todayCash}`, '']].map(([l, v, c]) => (
              <div key={l} className="card shrink-0 min-w-[7.5rem]"><p className="text-sm text-mute">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>))}
          </div>
          <input className="inp" type="search" placeholder="Search order number or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">
            {FILTERS.map(([k, l, f]) => <button key={k} onClick={() => setFilter(k)} className={`shrink-0 min-h-10 px-4 rounded-full text-sm font-medium border ${filter === k ? 'bg-ink text-white border-ink' : 'bg-white border-line'}`}>{l} <span className="opacity-60">{count(f)}</span></button>)}
          </div>
          {shown.length === 0 && <div className="card text-center text-mute py-12">{orders.length ? 'No orders match this filter.' : 'No orders yet. Scan your shop QR code with a phone and place a test order.'}</div>}
          <div className="grid lg:grid-cols-2 gap-3 items-start">{shown.map((o) => <OrderCard key={o.id} o={o} act={act} onCancel={(x) => { setCancelFor(x); setReason(''); }} />)}</div>
        </>}
        {view === 'reports' && <Reports />}
        {view === 'pricing' && <Pricing toast={toast} />}
        {view === 'settings' && <Settings toast={toast} onSignOut={signOut} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)] no-print" aria-label="Main">
        {NAV.map(([k, icon, l]) => <button key={k} onClick={() => setView(k)} className={`relative flex flex-col items-center justify-center min-h-14 text-xs font-medium ${view === k ? 'text-brand' : 'text-mute'}`}><span className="text-xl">{icon}</span>{l}{k === 'orders' && newCount > 0 && <span className="absolute top-1 right-[22%] pill bg-red-600 text-white !px-1.5">{newCount}</span>}</button>)}
      </nav>

      {cancelFor && <Sheet title={`Cancel ${cancelFor.order_no}?`} onClose={() => setCancelFor(null)}>
        <p className="text-sm text-mute">The customer will see the reason. Their files are deleted right away.</p>
        <div className="flex gap-2 flex-wrap">{['Unreadable file', 'Wrong settings', 'Not paid', 'Customer asked'].map((r) => <button key={r} className="btn2 btn-sm" onClick={() => setReason(r)}>{r}</button>)}</div>
        <input className="inp" placeholder="Reason (optional)" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2"><button className="btn2 flex-1" onClick={() => setCancelFor(null)}>Keep order</button>
          <button className="btn flex-1 !bg-red-600" onClick={() => { act(cancelFor, { status: 'cancelled', note: reason }); setCancelFor(null); }}>Cancel order</button></div>
      </Sheet>}
      {toastMsg && <div role="status" className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 slide-up px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg ${toastMsg.bad ? 'bg-red-600' : 'bg-ink'}`}>{toastMsg.m}</div>}
    </div>
  );
}
