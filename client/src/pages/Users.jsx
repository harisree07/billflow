import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';

export default function Users() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'cashier' });
  const load = () => api.get('/api/users').then(setList);
  useEffect(() => { load(); }, []);
  const add = async () => {
    try { await api.post('/api/users', form); setForm({ name:'', email:'', password:'', role:'cashier' }); load(); toast.success('User created'); }
    catch (e) { toast.error(e.message); }
  };
  const del = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    await api.del(`/api/users/${u.id}`); load();
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input className="input" placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <input className="input" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
        <select className="select" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
          <option value="admin">Admin</option><option value="manager">Manager</option><option value="cashier">Cashier</option>
        </select>
        <button className="btn-primary" onClick={add}>Add User</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><span className="badge bg-slate-200 capitalize">{u.role}</span></td>
                <td><button onClick={()=>del(u)} className="text-red-600 hover:underline text-xs">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
