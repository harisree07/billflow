import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('bf_user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('bf_token');
    if (!t) { setLoading(false); return; }
    api.get('/api/auth/me').then(d => setUser(d.user)).catch(() => {
      localStorage.removeItem('bf_token'); localStorage.removeItem('bf_user'); setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('bf_token', d.token);
    localStorage.setItem('bf_user', JSON.stringify(d.user));
    setUser(d.user);
  };
  const logout = () => {
    localStorage.removeItem('bf_token'); localStorage.removeItem('bf_user'); setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout, loading }}>{children}</Ctx.Provider>;
}
