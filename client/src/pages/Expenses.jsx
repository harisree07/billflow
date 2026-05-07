import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../lib/api.js';
import toast from 'react-hot-toast';

export default function Expenses() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title:'', amount:0, category:'', notes:'' });
  const load = () => api.get('/api/expenses').then(setList);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.title || !form.amount) return;
    await api.post('/api/expenses', form);
    setForm({ title:'', amount:0, category:'', notes:'' });
    toast.success('Expense added'); load();
  };
  const total = list.reduce((s,e) => s + e.amount, 0);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Expenses</h1>
      <div className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <input className="input md:col-span-2" placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
        <input className="input" type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm({...form, amount:+e.target.value})} />
        <input className="input" placeholder="Category" value={form.category} onChange={e=>setForm({...form, category:e.target.value})} />
        <button className="btn-primary" onClick={add}>Add</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Title</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id}><td>{fmtDate(e.created_at)}</td><td>{e.title}</td><td>{e.category}</td><td className="text-right">{fmt(e.amount)}</td></tr>
            ))}
            <tr className="font-bold"><td colSpan={3}>Total</td><td className="text-right">{fmt(total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
