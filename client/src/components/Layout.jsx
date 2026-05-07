import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/billing', label: 'New Bill' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/customers', label: 'Customers' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/reports', label: 'Reports' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/audit', label: 'Audit Log', roles: ['admin','manager'] },
  { to: '/users', label: 'Users', roles: ['admin'] },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 text-xl font-bold border-b border-slate-800">
          BillFlow
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV.filter(n => !n.roles || n.roles.includes(user?.role)).map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({isActive}) =>
                `block px-3 py-2 rounded-md text-sm ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 text-xs">
          <div className="text-slate-400">Signed in as</div>
          <div className="font-medium">{user?.name}</div>
          <div className="text-slate-400 capitalize">{user?.role}</div>
          <button onClick={() => { logout(); nav('/login'); }}
            className="mt-2 w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-red-400">Logout</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-5">
          <div className="text-sm text-slate-500 dark:text-slate-400">Billing & Inventory Management</div>
          <button onClick={toggle} className="btn-ghost" title="Toggle theme">
            {dark ? 'Light' : 'Dark'}
          </button>
        </header>
        <div className="flex-1 overflow-auto p-5">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

import { Component } from 'react';
class ErrorBoundary extends Component {
  constructor(p){ super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err, info){ console.error('Page error:', err, info); }
  render(){
    if (this.state.err) {
      return (
        <div className="card p-5">
          <h2 className="font-semibold text-red-600 mb-2">Something went wrong on this page</h2>
          <pre className="text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-300">{String(this.state.err?.message || this.state.err)}</pre>
          <button className="btn-secondary mt-3" onClick={()=>this.setState({err:null})}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
