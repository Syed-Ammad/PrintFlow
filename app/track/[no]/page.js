'use client';
import { useEffect, useRef, useState } from 'react';

const STEPS = [['submitted', 'Order received'], ['approved', 'Approved, in queue'], ['printing', 'Printing'], ['ready', 'Ready for collection'], ['collected', 'Collected']];

export default function Track({ params }) {
  const [d, setD] = useState(null);
  const [perm, setPerm] = useState('unsupported');
  const prev = useRef(null);

  useEffect(() => {
    if ('Notification' in window) setPerm(Notification.permission);
    const t = new URLSearchParams(location.search).get('t') || '';
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/orders/${params.no}?t=${encodeURIComponent(t)}`);
        const j = await r.json();
        if (stop) return;
        if (!r.ok) return setD({ error: true });
        setD(j);
        const s = j.order.status;
        if (prev.current && prev.current !== s && s === 'ready') {
          try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Your prints are ready', { body: `${j.order.order_no} at ${j.order.shop_name}` });
        }
        prev.current = s;
      } catch {}
    };
    load();
    const i = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => { stop = true; clearInterval(i); };
  }, [params.no]);

  if (!d) return <p className="p-6 text-mute">Loading…</p>;
  if (d.error) return <main className="p-6 max-w-md mx-auto"><div className="card">We could not find this order. Please open the tracking link you received after ordering.</div></main>;
  const { order: o } = d;
  const idx = STEPS.findIndex(([k]) => k === o.status);
  const stepIdx = o.status === 'hold' ? 1 : idx;
  const live = !['collected', 'cancelled'].includes(o.status);

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="card"><p className="text-sm text-mute">{o.shop_name}</p><h1 className="text-xl font-bold">{o.order_no}</h1>
        <span className={`pill mt-2 ${o.pay_status === 'paid' ? 'bg-green-100 text-green-700' : o.pay_status === 'refunded' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
          {o.pay_status === 'paid' ? 'Paid' : o.pay_status === 'refunded' ? 'Refunded' : `Pay Rs. ${o.total} in cash at the counter`}</span></div>
      {o.status === 'ready' && <div className="pop rounded-2xl bg-green-600 text-white p-4 font-semibold text-center text-lg">Your order is ready for collection 🎉</div>}
      {o.status === 'hold' && <div className="rounded-2xl bg-amber-50 text-amber-800 p-4 text-sm font-medium">Your order is on hold for a moment. The shop will update it soon.</div>}
      {o.status === 'cancelled' ? <div className="card text-red-700"><p className="font-semibold">This order was cancelled.</p>{o.note && <p className="text-sm mt-1">Reason: {o.note}</p>}</div> : (
        <ol className="card space-y-4">
          {STEPS.map(([k, label], i) => (
            <li key={k} className={`flex items-center gap-3 ${i > stepIdx ? 'text-mute' : ''} ${i === stepIdx ? 'font-bold text-brand' : ''}`}>
              <span className={`w-7 h-7 rounded-full grid place-items-center text-xs ${i < stepIdx ? 'bg-brand text-white' : i === stepIdx ? 'bg-brand text-white pulse' : 'border border-line'}`}>{i < stepIdx ? '✓' : ''}</span>{label}</li>))}
        </ol>)}
      {live && d.eta > 0 && <div className="card text-sm"><b>{d.ahead}</b> order{d.ahead !== 1 && 's'} ahead of you · about <b>{d.eta} min</b></div>}
      {live && perm === 'default' && <button className="btn2 w-full" onClick={async () => setPerm(await Notification.requestPermission())}>🔔 Notify me when it is ready</button>}
      <div className="card text-sm space-y-1.5">{d.docs.map((x, i) => <p key={i} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><span className="shrink-0">{x.pages} pg · Rs. {x.price}</span></p>)}</div>
      <p className="text-xs text-mute text-center">This page updates by itself. Keep it open or come back with the same link.</p>
    </main>
  );
}
