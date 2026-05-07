import { useEffect, useState } from 'react';
import { api, fmt, fmtDate, today, daysAgo } from '../lib/api.js';
import { Link } from 'react-router-dom';

export default function Invoices() {
  const [bills, setBills] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');

  const load = () => {
    const q = new URLSearchParams({ from, to });
    if (status) q.set('status', status);
    if (mode) q.set('mode', mode);
    api.get('/api/bills?' + q).then(setBills);
  };
  useEffect(() => { load(); }, [from, to, status, mode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link to="/billing" className="btn-primary">+ New Bill</Link>
      </div>
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></div>
        <div><label className="label">Status</label><select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All</option><option value="active">Active</option><option value="cancelled">Cancelled</option>
        </select></div>
        <div><label className="label">Mode</label><select className="select" value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="">All</option>{['cash','card','upi','bank','split'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
        </select></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>
            <th>Invoice</th><th>Date</th><th>Customer</th><th>Mode</th><th>Status</th><th>Payment</th><th className="text-right">Total</th><th></th>
          </tr></thead>
          <tbody>
            {bills.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No invoices in range</td></tr>}
            {bills.map(b => (
              <tr key={b.id}>
                <td className="font-mono">{b.invoice_no}</td>
                <td>{fmtDate(b.created_at)}</td>
                <td>{b.customer_name || '—'}</td>
                <td className="uppercase text-xs">{b.payment_mode || '—'}</td>
                <td>{b.status === 'cancelled'
                  ? <span className="badge bg-red-100 text-red-700">Cancelled</span>
                  : <span className="badge bg-emerald-100 text-emerald-700">Active</span>}</td>
                <td><span className={`badge ${b.payment_status==='paid'?'bg-emerald-100 text-emerald-700':b.payment_status==='partial'?'bg-amber-100 text-amber-700':'bg-slate-200 text-slate-700'}`}>{b.payment_status}</span></td>
                <td className="text-right font-medium">{fmt(b.total)}</td>
                <td><Link to={`/invoices/${b.id}`} className="text-brand-600 hover:underline text-xs">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
