import { useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import toast from 'react-hot-toast';

const empty = { name:'', phone:'', email:'', address:'', gstin:'' };

export default function PartyList({ kind }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get(`/api/${kind}`).then(setRows);
  useEffect(() => { load(); }, [kind]);

  const save = async () => {
    try {
      if (editing.id) await api.put(`/api/${kind}/${editing.id}`, editing);
      else await api.post(`/api/${kind}`, editing);
      toast.success('Saved'); setEditing(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (r) => {
    if (!confirm('Delete?')) return;
    await api.del(`/api/${kind}/${r.id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold capitalize">{kind}</h1>
        <button className="btn-primary" onClick={()=>setEditing({...empty})}>+ Add</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>GSTIN</th><th className="text-right">Balance</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{r.phone}</td><td>{r.email}</td><td className="font-mono text-xs">{r.gstin}</td>
                <td className="text-right">{fmt(r.balance||0)}</td>
                <td className="space-x-2 text-xs">
                  <button onClick={()=>setEditing(r)} className="text-brand-600 hover:underline">Edit</button>
                  <button onClick={()=>del(r)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No records</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setEditing(null)}>
          <div className="card p-5 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-3">{editing.id?'Edit':'New'}</h2>
            <div className="grid grid-cols-2 gap-3">
              {['name','phone','email','gstin'].map(k => (
                <div key={k}><label className="label capitalize">{k}</label>
                  <input className="input" value={editing[k]||''} onChange={e=>setEditing({...editing, [k]:e.target.value})} /></div>
              ))}
              <div className="col-span-2"><label className="label">Address</label>
                <textarea className="textarea" rows={2} value={editing.address||''} onChange={e=>setEditing({...editing, address:e.target.value})} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
