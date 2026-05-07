import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmt, fmtDate } from '../lib/api.js';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

export default function InvoiceView({ print = false }) {
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [settings, setSettings] = useState(null);
  const [qr, setQr] = useState('');
  const [layout, setLayout] = useState('a4'); // 'a4' or 'thermal'

  useEffect(() => {
    Promise.all([api.get(`/api/bills/${id}`), api.get('/api/settings')]).then(([b, s]) => {
      setBill(b); setSettings(s);
    });
  }, [id]);

  useEffect(() => {
    if (!bill || !settings?.upi_id) return;
    const due = bill.total - bill.paid;
    const amt = due > 0 ? due : bill.total;
    const upi = `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(settings.upi_payee||settings.business_name||'Merchant')}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(bill.invoice_no)}`;
    QRCode.toDataURL(upi, { width: 180, margin: 1 }).then(setQr);
  }, [bill, settings]);

  useEffect(() => {
    if (print && bill) setTimeout(() => window.print(), 400);
  }, [print, bill]);

  if (!bill || !settings) return <div>Loading…</div>;

  const cancel = async () => {
    if (!confirm('Cancel this bill? Stock will be returned.')) return;
    await api.post(`/api/bills/${bill.id}/cancel`);
    toast.success('Bill cancelled');
    api.get(`/api/bills/${id}`).then(setBill);
  };

  const recordPayment = async () => {
    const amount = +prompt('Amount received', (bill.total - bill.paid).toFixed(2));
    if (!amount) return;
    const mode = prompt('Mode (cash/card/upi/bank)', 'cash') || 'cash';
    await api.post(`/api/bills/${bill.id}/pay`, { amount, mode });
    toast.success('Payment recorded');
    api.get(`/api/bills/${id}`).then(setBill);
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Link to="/invoices" className="btn-ghost">← Back</Link>
          <select className="select w-32" value={layout} onChange={e=>setLayout(e.target.value)}>
            <option value="a4">A4 Invoice</option>
            <option value="thermal">Thermal 80mm</option>
          </select>
        </div>
        <div className="flex gap-2">
          {bill.status !== 'cancelled' && bill.payment_status !== 'paid' && (
            <button onClick={recordPayment} className="btn-secondary">Record Payment</button>
          )}
          {bill.status !== 'cancelled' && (
            <button onClick={cancel} className="btn-danger">Cancel Bill</button>
          )}
          <button onClick={() => window.print()} className="btn-primary">Print</button>
        </div>
      </div>

      <div className={`print-area mx-auto ${layout === 'thermal' ? 'max-w-[80mm]' : 'max-w-3xl'}`}>
        <div className="card p-6 bg-white text-slate-900">
          <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xl font-bold">{settings.business_name}</div>
              <div className="text-xs text-slate-600 whitespace-pre-line">{settings.address}</div>
              <div className="text-xs text-slate-600">{settings.phone}</div>
              {settings.gstin && <div className="text-xs text-slate-600">GSTIN: {settings.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">TAX INVOICE</div>
              <div className="text-xs">No: <span className="font-mono">{bill.invoice_no}</span></div>
              <div className="text-xs">{fmtDate(bill.created_at)}</div>
              {bill.status === 'cancelled' && <div className="mt-1 text-red-600 font-bold">CANCELLED</div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <div className="font-semibold mb-1">Bill To:</div>
              <div>{bill.customer_name || 'Walk-in Customer'}</div>
              {bill.customer_phone && <div>{bill.customer_phone}</div>}
            </div>
            <div className="text-right">
              <div className="font-semibold mb-1">Payment:</div>
              <div className="uppercase">{bill.payment_mode || '—'}</div>
              <div className={`badge mt-1 ${bill.payment_status==='paid'?'bg-emerald-100 text-emerald-700':bill.payment_status==='partial'?'bg-amber-100 text-amber-700':'bg-slate-200'}`}>{bill.payment_status}</div>
            </div>
          </div>

          <table className="w-full text-xs mb-4">
            <thead><tr className="border-b border-slate-300">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Qty</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Tax</th>
              <th className="text-right py-1">Total</th>
            </tr></thead>
            <tbody>
              {bill.items.map(it => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="py-1">{it.name}</td>
                  <td className="text-right">{it.qty}</td>
                  <td className="text-right">{fmt(it.price)}</td>
                  <td className="text-right">{it.tax_rate}%</td>
                  <td className="text-right">{fmt(it.total + it.total*it.tax_rate/100)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-end">
            <div>
              {qr && bill.status !== 'cancelled' && (
                <div className="text-center">
                  <img src={qr} alt="UPI QR" className="w-32 h-32" />
                  <div className="text-[10px] mt-1">Scan to pay via UPI</div>
                  <div className="text-[10px] font-mono">{settings.upi_id}</div>
                </div>
              )}
            </div>
            <div className="text-right text-sm space-y-1 min-w-[180px]">
              <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(bill.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax:</span><span>{fmt(bill.tax)}</span></div>
              {bill.discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{fmt(bill.discount)}</span></div>}
              <div className="flex justify-between text-base font-bold border-t border-slate-300 pt-1"><span>Total:</span><span>{fmt(bill.total)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Paid:</span><span>{fmt(bill.paid)}</span></div>
              {bill.due > 0 && <div className="flex justify-between text-red-700"><span>Due:</span><span>{fmt(bill.due)}</span></div>}
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-500 border-t border-slate-200 pt-2">
            Thank you for your business! · {settings.business_name}
          </div>
        </div>
      </div>
    </div>
  );
}
