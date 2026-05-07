import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@billflow.in');
  const [password, setPassword] = useState('admin123');
  const [busy, setBusy] = useState(false);

  if (user) { nav('/'); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      nav('/');
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-600 to-brand-700 p-6">
      <div className="w-full max-w-md card p-8">
        <div className="text-center mb-6">
          
          <h1 className="text-2xl font-bold">BillFlow</h1>
          <p className="text-sm text-slate-500">Billing & Inventory Management</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy?'Signing in…':'Sign In'}</button>
        </form>
        <div className="mt-6 text-xs text-slate-500 space-y-1">
          <div className="font-medium">Demo accounts:</div>
          <div>admin@billflow.in / admin123</div>
          <div>manager@billflow.in / manager123</div>
          <div>cashier@billflow.in / cashier123</div>
        </div>
      </div>
    </div>
  );
}
