import { useEffect, useState } from 'react';
import { api, fmt, today, daysAgo } from '../lib/api.js';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Link } from 'react-router-dom';

const COLORS = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [from] = useState(daysAgo(29));
  const [to] = useState(today());

  useEffect(() => {
    api.get(`/api/reports/summary?from=${from}&to=${to}`).then(setData);
  }, [from, to]);

  if (!data) return <div>Loading…</div>;

  const stats = [
    { label: 'Revenue (30d)', value: fmt(data.totals.revenue), color: 'bg-brand-600' },
    { label: 'Bills', value: data.totals.count, color: 'bg-emerald-600' },
    { label: 'Tax Collected', value: fmt(data.totals.tax), color: 'bg-amber-500' },
    { label: 'Outstanding Dues', value: fmt(data.totals.due), color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/billing" className="btn-primary">+ New Bill</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
            <div className={`mt-2 h-1 w-12 rounded ${s.color}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="font-semibold mb-3">Revenue — last 30 days</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.byDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-3">Payment Modes</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byMode} dataKey="amount" nameKey="mode" outerRadius={80} label>
                  {data.byMode.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold mb-3">Top Selling Products</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-3">Low Stock Alerts</div>
          {data.lowStock.length === 0 ? (
            <div className="text-sm text-slate-500">All products are well stocked. </div>
          ) : (
            <table className="table">
              <thead><tr><th>Product</th><th>Stock</th><th>Threshold</th></tr></thead>
              <tbody>
                {data.lowStock.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className={`badge ${p.stock<=0?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{p.stock}</span></td>
                    <td>{p.low_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
