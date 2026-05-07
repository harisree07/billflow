import { useEffect, useState } from 'react';
import { api, fmt, today, daysAgo, fmtDate } from '../lib/api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [bills, setBills] = useState([]);

  const load = () => {
    api.get(`/api/reports/summary?from=${from}&to=${to}`).then(setData);
    api.get(`/api/bills?from=${from}&to=${to}`).then(setBills);
  };
  useEffect(() => { load(); }, [from, to]);

  const exportCSV = () => {
    const rows = [['Invoice','Date','Customer','Mode','Status','Subtotal','Tax','Discount','Total','Paid','Due']];
    bills.forEach(b => rows.push([b.invoice_no, b.created_at, b.customer_name||'', b.payment_mode||'', b.payment_status, b.subtotal, b.tax, b.discount, b.total, b.paid, b.due]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sales-${from}-to-${to}.csv`; a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text('Sales Report', 14, 15);
    doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, 14, 22);
    if (data) {
      doc.text(`Revenue: Rs ${data.totals.revenue.toFixed(2)}`, 14, 29);
      doc.text(`Bills: ${data.totals.count}   Tax: Rs ${data.totals.tax.toFixed(2)}   Due: Rs ${data.totals.due.toFixed(2)}`, 14, 35);
    }
    autoTable(doc, {
      startY: 42,
      head: [['Invoice','Date','Customer','Mode','Total']],
      body: bills.map(b => [b.invoice_no, fmtDate(b.created_at), b.customer_name||'', (b.payment_mode||'').toUpperCase(), 'Rs '+b.total.toFixed(2)]),
      styles: { fontSize: 8 },
    });
    doc.save(`sales-${from}-to-${to}.pdf`);
  };

  if (!data) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex flex-wrap gap-2 items-end">
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></div>
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn-secondary" onClick={exportPDF}>Export PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label="Revenue" value={fmt(data.totals.revenue)} />
        <Stat label="Bills" value={data.totals.count} />
        <Stat label="Tax Collected" value={fmt(data.totals.tax)} />
        <Stat label="Outstanding" value={fmt(data.totals.due)} />
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-3">Daily Revenue</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Bar dataKey="revenue" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">Bills in period</div>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Mode</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {bills.map(b => (
              <tr key={b.id}>
                <td className="font-mono">{b.invoice_no}</td>
                <td>{fmtDate(b.created_at)}</td>
                <td>{b.customer_name||'—'}</td>
                <td className="uppercase text-xs">{b.payment_mode||'—'}</td>
                <td className="text-right">{fmt(b.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="card p-4">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>;
}
