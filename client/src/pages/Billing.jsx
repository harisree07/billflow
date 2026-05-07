import { useEffect, useState, useRef, useMemo } from 'react';
import { api, fmt } from '../lib/api.js';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const MODES = ['cash','card','upi','bank','split'];

export default function Billing() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [splits, setSplits] = useState([{ mode: 'cash', amount: 0 }, { mode: 'upi', amount: 0 }]);
  const [paidNow, setPaidNow] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef();
  const nav = useNavigate();

  useEffect(() => { api.get('/api/customers').then(setCustomers); searchRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim().length >= 1) api.get(`/api/products?q=${encodeURIComponent(search)}`).then(setResults);
      else setResults([]);
    }, 150);
    return () => clearTimeout(t);
  }, [search]);

  // Keyboard: F2 focus search, Enter on barcode
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addItem = (p) => {
    setItems(prev => {
      const ex = prev.find(i => i.product_id === p.id);
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product_id: p.id, name: p.name, qty: 1, price: p.price, tax_rate: p.tax_rate, discount: 0 }];
    });
    setSearch(''); setResults([]); searchRef.current?.focus();
  };

  const tryBarcode = async (code) => {
    try {
      const p = await api.get(`/api/products/barcode/${encodeURIComponent(code)}`);
      addItem(p);
    } catch { toast.error('Barcode not found'); }
  };

  const updateItem = (idx, patch) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const it of items) {
      const line = it.price * it.qty - (+it.discount || 0);
      sub += line;
      tax += line * (it.tax_rate || 0) / 100;
    }
    const total = Math.round((sub + tax - (+discount||0)) * 100)/100;
    return { sub, tax, total };
  }, [items, discount]);

  useEffect(() => { setPaidNow(totals.total); }, [totals.total]);

  const buildPayments = () => {
    if (mode === 'split') return splits.filter(s => +s.amount > 0).map(s => ({ mode: s.mode, amount: +s.amount }));
    return paidNow > 0 ? [{ mode, amount: +paidNow }] : [];
  };

  const save = async (printAfter = false) => {
    if (!items.length) return toast.error('Add at least one item');
    setBusy(true);
    try {
      const payload = {
        customer_id: customer?.id || null,
        customer_name: customer?.name || walkInName || 'Walk-in',
        customer_phone: customer?.phone || walkInPhone || null,
        items, discount: +discount || 0, payments: buildPayments(), notes,
      };
      const r = await api.post('/api/bills', payload);
      toast.success('Bill saved: ' + r.invoice_no);
      if (printAfter) window.open(`/invoices/${r.id}/print`, '_blank');
      else nav(`/invoices/${r.id}`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">Search products (name / SKU / barcode) — F2</label>
              <input ref={searchRef} className="input" placeholder="Type to search or scan barcode and press Enter…"
                value={search} onChange={e=>setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (results[0]) addItem(results[0]);
                    else if (search.trim()) tryBarcode(search.trim());
                  }
                }} />
            </div>
          </div>
          {results.length > 0 && (
            <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-md max-h-60 overflow-y-auto">
              {results.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex justify-between text-sm">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.sku} · stock {p.stock}</div>
                  </div>
                  <div className="text-right">{fmt(p.price)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr>
              <th>Item</th><th className="w-24">Qty</th><th className="w-28">Price</th>
              <th className="w-24">Disc</th><th className="w-20">Tax%</th><th className="w-28 text-right">Total</th><th></th>
            </tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-10">No items yet — search above to add.</td></tr>}
              {items.map((it, i) => {
                const line = it.price*it.qty - (+it.discount||0);
                const lineTotal = line + line * (it.tax_rate||0)/100;
                return (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td><input type="number" min="0.01" step="0.01" className="input py-1" value={it.qty}
                      onChange={e=>updateItem(i, { qty: +e.target.value || 0 })} /></td>
                    <td><input type="number" className="input py-1" value={it.price}
                      onChange={e=>updateItem(i, { price: +e.target.value || 0 })} /></td>
                    <td><input type="number" className="input py-1" value={it.discount}
                      onChange={e=>updateItem(i, { discount: +e.target.value || 0 })} /></td>
                    <td><input type="number" className="input py-1" value={it.tax_rate}
                      onChange={e=>updateItem(i, { tax_rate: +e.target.value || 0 })} /></td>
                    <td className="text-right font-medium">{fmt(lineTotal)}</td>
                    <td><button onClick={()=>removeItem(i)} className="text-red-500 hover:underline text-xs">Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="font-semibold mb-2">Customer</div>
          <select className="select mb-2" value={customer?.id || ''} onChange={e => {
            const c = customers.find(x => x.id == e.target.value);
            setCustomer(c || null);
          }}>
            <option value="">Walk-in / new</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone?`· ${c.phone}`:''}</option>)}
          </select>
          {!customer && (
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Name" value={walkInName} onChange={e=>setWalkInName(e.target.value)} />
              <input className="input" placeholder="Phone" value={walkInPhone} onChange={e=>setWalkInPhone(e.target.value)} />
            </div>
          )}
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmt(totals.sub)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax</span><span>{fmt(totals.tax)}</span></div>
          <div className="flex justify-between text-sm items-center">
            <span>Discount</span>
            <input type="number" className="input py-1 w-28 text-right" value={discount} onChange={e=>setDiscount(+e.target.value||0)} />
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-slate-200 dark:border-slate-700 pt-2">
            <span>Grand Total</span><span>{fmt(totals.total)}</span>
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="font-semibold">Payment</div>
          <select className="select" value={mode} onChange={e=>setMode(e.target.value)}>
            {MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
          {mode !== 'split' ? (
            <div>
              <label className="label">Amount received</label>
              <input type="number" className="input" value={paidNow} onChange={e=>setPaidNow(+e.target.value||0)} />
            </div>
          ) : (
            <div className="space-y-2">
              {splits.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <select className="select py-1" value={s.mode} onChange={e=>setSplits(splits.map((x,j)=>j===i?{...x,mode:e.target.value}:x))}>
                    {['cash','card','upi','bank'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                  <input type="number" className="input py-1" value={s.amount}
                    onChange={e=>setSplits(splits.map((x,j)=>j===i?{...x,amount:+e.target.value||0}:x))} />
                </div>
              ))}
              <button className="btn-ghost text-xs" onClick={()=>setSplits([...splits, {mode:'cash',amount:0}])}>+ Add split</button>
            </div>
          )}
          <textarea className="textarea" rows={2} placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button className="btn-secondary" disabled={busy} onClick={()=>save(false)}>Save</button>
            <button className="btn-primary" disabled={busy} onClick={()=>save(true)}>Save & Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}
