'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultSettings, priceDoc } from '@/lib/pricing';

const MAX = 25 * 1024 * 1024;
const vib = (p = 12) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
const isImg = (n) => /\.(jpe?g|png)$/i.test(n);

async function countPages(file) {
  if (isImg(file.name)) return 1;
  const { PDFDocument } = await import('pdf-lib'); // loaded only when needed: faster first load on phones
  return (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
}
function useCountUp(v) {
  const [x, setX] = useState(v); const from = useRef(v);
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf;
    const tick = (t) => { const p = Math.min(1, (t - t0) / 300); setX(Math.round(a + (v - a) * p)); if (p < 1) raf = requestAnimationFrame(tick); else from.current = v; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [v]);
  return x;
}
const describe = (s) => `${s.size} · ${s.color ? 'Colour' : 'B&W'} · ${s.duplex ? 'Double' : 'Single'}-sided · ${s.copies} ${s.copies > 1 ? 'copies' : 'copy'}`;

function Seg({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => { vib(8); onChange(v); }}
          className={`min-h-12 rounded-xl border text-sm font-semibold transition active:scale-95 ${value === v ? 'bg-brand text-white border-brand' : 'bg-white border-line'}`}>{label}</button>
      ))}
    </div>
  );
}
const FileIcon = ({ it }) => it.thumb
  ? <img src={it.thumb} alt="" className="w-12 h-12 rounded-lg object-cover bg-bg" />
  : <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 grid place-items-center text-xs font-bold">PDF</div>;

export default function ShopPage({ params }) {
  const { slug } = params;
  const [info, setInfo] = useState(null);
  const [step, setStep] = useState(0);
  const [items, setItems] = useState([]);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetch(`/api/shop/${slug}`).then((r) => r.json()).then(setInfo).catch(() => setInfo({ error: true }));
    try { setRecent(JSON.parse(localStorage.getItem('pf_recent') || '[]')); } catch {}
  }, [slug]);

  const prices = useMemo(() => (info?.prices ? Object.fromEntries(info.prices.map((p) => [p.key, p.value])) : {}), [info]);
  const calc = items.map((it) => priceDoc(prices, it.pages, it.settings));
  const total = calc.reduce((s, c) => s + (c.price || 0), 0);
  const hasError = calc.some((c) => c.error);
  const shownTotal = useCountUp(total);
  const open = info?.shop?.accepting;

  async function addFiles(list) {
    setErr(''); setReading(true);
    for (const file of Array.from(list)) {
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { setErr(`${file.name}: only PDF, JPG and PNG are supported`); continue; }
      if (file.size > MAX) { setErr(`${file.name}: file is too large (max 25 MB)`); continue; }
      if (items.some((i) => i.file.name === file.name && i.file.size === file.size)) { setErr(`${file.name} is already added`); continue; }
      try {
        const pages = await countPages(file);
        setItems((p) => [...p, { file, pages, settings: defaultSettings(), thumb: isImg(file.name) ? URL.createObjectURL(file) : null }]);
        vib(10);
      } catch { setErr(`${file.name}: could not read this PDF. Is it password protected?`); }
    }
    setReading(false);
  }
  const setS = (i, patch) => setItems((p) => p.map((it, j) => (j === i ? { ...it, settings: { ...it.settings, ...patch } } : it)));
  const remove = (i) => { setItems((p) => p.filter((_, j) => j !== i)); setCur(0); };

  function submit() {
    setBusy(true); setErr(''); setProgress(0);
    const fd = new FormData();
    fd.append('meta', JSON.stringify({ slug, phone, settings: items.map((i) => i.settings) }));
    items.forEach((i) => fd.append('files', i.file));
    const x = new XMLHttpRequest();
    x.open('POST', '/api/orders');
    x.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => { setBusy(false); setErr('Network problem. Check your connection and try again.'); };
    x.onload = () => {
      setBusy(false);
      let d = {}; try { d = JSON.parse(x.responseText); } catch {}
      if (x.status !== 200) return setErr(d.error || 'Could not place order');
      vib([30, 40, 30]); setDone(d);
      try {
        const list = [{ no: d.orderNo, t: d.token, shop: info.shop.name }, ...recent].slice(0, 5);
        localStorage.setItem('pf_recent', JSON.stringify(list));
      } catch {}
    };
    x.send(fd);
  }

  if (!info) return <p className="p-6 text-mute">Loading shop…</p>;
  if (info.error) return <p className="p-6">Shop not found. Please scan the QR code again.</p>;

  if (done) return (
    <main className="max-w-md mx-auto p-6 pt-12 text-center space-y-4">
      <div className="pop mx-auto w-20 h-20 rounded-full bg-green-100 text-green-600 grid place-items-center text-4xl">✓</div>
      <h1 className="text-2xl font-bold">Order placed!</h1>
      <div className="card slide-up">
        <p className="text-sm text-mute">Your order number</p>
        <p className="text-2xl font-bold tracking-wide">{done.orderNo}</p>
        <button className="btn2 btn-sm mt-2" onClick={() => { navigator.clipboard?.writeText(done.orderNo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy number'}</button>
      </div>
      <p className="pill bg-amber-100 text-amber-800 !text-sm">Pay Rs. {done.total} in cash at the counter</p>
      <p className="text-mute text-sm">Show this number at the counter to collect your prints. Save the tracking link: it is private to you.</p>
      <a className="btn flex items-center justify-center" href={`/track/${done.orderNo}?t=${done.token}`}>Track my order</a>
      <button className="btn2 w-full" onClick={() => { setDone(null); setItems([]); setStep(0); }}>Place another order</button>
    </main>
  );

  const { shop } = info;
  const canNext = step === 0 ? items.length > 0 && !reading : step === 1 ? !hasError : !busy;
  const it = items[cur], s = it?.settings;

  return (
    <main className="max-w-md mx-auto p-4 pb-36 space-y-4">
      <div className="card flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs text-mute">PrintFlow</p><h1 className="text-lg font-bold truncate">{shop.name}</h1><p className="text-xs text-mute truncate">{shop.address} · {shop.hours}</p></div>
        <span className={`pill shrink-0 ${open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{open ? `~${info.waitMinutes} min wait` : 'Closed'}</span>
      </div>

      {!open && <div role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm font-medium">This shop is not taking new orders right now. Please try again later.</div>}

      <ol className="flex items-center gap-2" aria-label="Progress">
        {['Upload', 'Settings', 'Review'].map((l, i) => (
          <li key={l} className="flex-1">
            <button disabled={i > step || (i > 0 && !items.length)} onClick={() => setStep(i)} className="w-full text-left">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand' : 'bg-line'}`} />
              <span className={`text-xs ${i === step ? 'font-bold text-brand' : 'text-mute'}`}>{i + 1}. {l}</span>
            </button>
          </li>))}
      </ol>

      {step === 0 && <div className="space-y-4 slide-up">
        <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); open && addFiles(e.dataTransfer.files); }}
          className={`block rounded-2xl border-2 border-dashed text-center py-9 px-4 transition ${open ? 'cursor-pointer' : 'opacity-50'} ${drag ? 'border-brand bg-blue-50' : 'border-line bg-white'}`}>
          <input type="file" multiple disabled={!open} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="text-3xl mb-1">📄</div>
          <p className="font-semibold">{reading ? 'Reading your file…' : items.length ? 'Add more files' : 'Tap to choose your documents'}</p>
          <p className="text-sm text-mute">PDF, JPG, PNG · up to 25 MB each · no account needed</p>
        </label>
        {err && <p role="alert" className="text-red-600 text-sm bg-red-50 rounded-xl p-3">{err}</p>}
        {items.map((x, i) => (
          <div key={x.file.name + i} className="card flex items-center gap-3 slide-up">
            <FileIcon it={x} />
            <div className="min-w-0 flex-1"><p className="font-semibold truncate">{x.file.name}</p><p className="text-sm text-mute">{x.pages} page{x.pages > 1 && 's'} · {(x.file.size / 1048576).toFixed(1)} MB</p></div>
            <button aria-label={`Remove ${x.file.name}`} className="w-10 h-10 rounded-full text-red-600 text-xl" onClick={() => remove(i)}>✕</button>
          </div>))}
        <details className="card"><summary className="font-semibold cursor-pointer min-h-8">Price list</summary>
          <ul className="mt-2 text-sm space-y-1.5">{info.prices.map((p) => <li key={p.key} className="flex justify-between"><span>{p.label}</span><b>{p.key === 'double_discount' ? `${p.value}%` : `Rs. ${p.value}`}</b></li>)}</ul></details>
        {recent.length > 0 && !items.length && <div className="card space-y-2"><p className="font-semibold text-sm">Your recent orders</p>
          {recent.map((r) => <a key={r.no} href={`/track/${r.no}?t=${r.t}`} className="flex justify-between text-sm text-brand min-h-10 items-center"><span>{r.no}</span><span className="text-mute">{r.shop}</span></a>)}</div>}
      </div>}

      {step === 1 && it && <div className="space-y-4 slide-up">
        {items.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">{items.map((x, i) => (
          <button key={i} onClick={() => setCur(i)} className={`shrink-0 max-w-[10rem] truncate min-h-10 px-3 rounded-full text-sm border ${i === cur ? 'bg-ink text-white border-ink' : 'bg-white border-line'}`}>{x.file.name}</button>))}</div>}
        <section className="card space-y-4">
          <div className="flex items-center gap-3"><FileIcon it={it} /><div className="min-w-0"><p className="font-semibold truncate">{it.file.name}</p><p className="text-sm text-mute">{it.pages} page{it.pages > 1 && 's'}</p></div></div>
          <div><p className="lbl">Paper size</p><Seg value={s.size} onChange={(v) => setS(cur, { size: v })} options={['A4', 'A3', 'A5'].map((x) => [x, x])} /></div>
          <div><p className="lbl">Colour</p><Seg value={s.color} onChange={(v) => setS(cur, { color: v })} options={[[false, 'Black & White'], [true, 'Colour']]} /></div>
          <div><p className="lbl">Sides</p><Seg value={s.duplex} onChange={(v) => setS(cur, { duplex: v })} options={[[false, 'Single-sided'], [true, 'Double-sided']]} /></div>
          <div className="flex items-center justify-between"><p className="lbl !mb-0">Copies</p>
            <div className="flex items-center gap-2">
              <button aria-label="Fewer copies" className="btn2 !px-0 w-12" onClick={() => { vib(8); setS(cur, { copies: Math.max(1, s.copies - 1) }); }}>−</button>
              <b className="w-10 text-center text-lg">{s.copies}</b>
              <button aria-label="More copies" className="btn2 !px-0 w-12" onClick={() => { vib(8); setS(cur, { copies: Math.min(500, s.copies + 1) }); }}>+</button></div></div>
          <div><p className="lbl">Pages to print</p><Seg value={s.range} onChange={(v) => setS(cur, { range: v })} options={[['all', `All ${it.pages}`], ['custom', 'Custom range']]} />
            {s.range === 'custom' && <input className="inp mt-2" inputMode="text" placeholder="e.g. 1-10, 20-30" value={s.rangeText} onChange={(e) => setS(cur, { rangeText: e.target.value })} />}</div>
          <div><p className="lbl">Orientation</p><Seg value={s.orientation} onChange={(v) => setS(cur, { orientation: v })} options={[['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']]} /></div>
          {['binding', 'stapling', 'lamination'].some((k) => prices[k] != null) && <div><p className="lbl">Extras</p>
            <div className="grid gap-2">{['binding', 'stapling', 'lamination'].filter((k) => prices[k] != null).map((k) => (
              <label key={k} className={`flex items-center justify-between min-h-12 px-3 rounded-xl border cursor-pointer ${s[k] ? 'border-brand bg-blue-50' : 'border-line'}`}>
                <span className="font-medium capitalize">{k === 'binding' ? 'Spiral binding' : k}</span><span className="text-sm text-mute">+ Rs. {prices[k]}</span>
                <input type="checkbox" className="w-5 h-5" checked={s[k]} onChange={(e) => setS(cur, { [k]: e.target.checked })} /></label>))}</div></div>}
          <p role="status" className={`text-sm rounded-lg p-2 ${calc[cur].error ? 'bg-red-50 text-red-700' : 'bg-bg text-mute'}`}>{calc[cur].error || `${calc[cur].pages} pages to print · Rs. ${calc[cur].price}`}</p>
          {items.length > 1 && <button className="btn2 btn-sm w-full" onClick={() => { setItems((p) => p.map((x) => ({ ...x, settings: { ...s } }))); vib(15); }}>Use these settings for all files</button>}
        </section>
      </div>}

      {step === 2 && <div className="space-y-4 slide-up">
        {items.map((x, i) => (
          <div key={i} className="card space-y-1">
            <div className="flex justify-between gap-2"><p className="font-semibold truncate">{x.file.name}</p><b>Rs. {calc[i].price}</b></div>
            <p className="text-sm text-mute">{calc[i].pages} pages · {describe(x.settings)}</p>
            <button className="text-brand text-sm font-semibold min-h-10" onClick={() => { setCur(i); setStep(1); }}>Edit settings</button>
          </div>))}
        <div className="card flex justify-between text-lg font-bold"><span>Total</span><span>Rs. {total}</span></div>
        <div className="card space-y-3">
          <p className="font-semibold">Payment</p>
          <div className="rounded-xl border-2 border-brand bg-blue-50 p-3"><p className="font-semibold">Pay cash at the shop</p><p className="text-sm text-mute">Pay when you collect your prints</p></div>
          <div className="rounded-xl border border-line p-3 opacity-50"><p className="font-semibold">Pay online</p><p className="text-sm">Easypaisa / JazzCash · coming soon</p></div>
          <div><label className="lbl block" htmlFor="ph">Phone number (optional)</label><input id="ph" className="inp" inputMode="tel" autoComplete="tel" placeholder="+92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <p className="text-xs text-mute">Your files are used only for this order and are deleted after you collect it.</p>
        {err && <p role="alert" className="text-red-600 text-sm bg-red-50 rounded-xl p-3">{err}</p>}
      </div>}

      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {busy && <div className="max-w-md mx-auto mb-2"><div className="h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs text-mute mt-1">Uploading {progress}%</p></div>}
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="min-w-[5.5rem]"><p className="text-xs text-mute">{step === 0 ? `${items.length} file${items.length > 1 ? 's' : ''}` : 'Total'}</p><p className="text-xl font-bold">{step === 0 ? '' : `Rs. ${shownTotal}`}</p></div>
            <button className="btn flex-1" disabled={!canNext || !open} onClick={() => { vib(10); window.scrollTo({ top: 0, behavior: 'smooth' }); step < 2 ? setStep(step + 1) : submit(); }}>
              {step === 0 ? 'Continue' : step === 1 ? 'Review order' : busy ? 'Placing order…' : 'Place order'}</button>
          </div>
        </div>)}
    </main>
  );
}
