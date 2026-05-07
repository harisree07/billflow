import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/api/settings').then(setS); }, []);
  if (!s) return <div>Loading…</div>;

  const save = async () => {
    try { await api.put('/api/settings', s); toast.success('Saved'); }
    catch (e) { toast.error(e.message); }
  };
  const backup = () => api.download('/api/backup', `billflow-${Date.now()}.db`);

  const fields = [
    ['business_name','Business Name','text'],
    ['phone','Phone','text'],
    ['gstin','GSTIN','text'],
    ['address','Address','textarea'],
    ['upi_id','UPI ID (e.g. merchant@upi)','text'],
    ['upi_payee','UPI Payee Name','text'],
    ['tax_rate','Default Tax %','number'],
    ['invoice_prefix','Invoice Prefix','text'],
    ['low_stock_threshold','Default Low-stock Threshold','number'],
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(([k,l,t]) => (
          <div key={k} className={t==='textarea'?'md:col-span-2':''}>
            <label className="label">{l}</label>
            {t==='textarea'
              ? <textarea className="textarea" rows={2} value={s[k]||''} onChange={e=>setS({...s, [k]:e.target.value})} />
              : <input className="input" type={t} value={s[k]??''} onChange={e=>setS({...s, [k]: t==='number'?+e.target.value:e.target.value})} />}
          </div>
        ))}
        <div className="md:col-span-2 flex justify-end">
          <button className="btn-primary" onClick={save}>Save Settings</button>
        </div>
      </div>

      {user.role === 'admin' && (
        <div className="card p-5">
          <div className="font-semibold mb-2">Backup & Restore</div>
          <p className="text-sm text-slate-500 mb-3">Download the entire SQLite database file. To restore, replace <code>server/data/billflow.db</code> and restart the server.</p>
          <button className="btn-secondary" onClick={backup}>Download Backup (.db)</button>
        </div>
      )}
    </div>
  );
}
