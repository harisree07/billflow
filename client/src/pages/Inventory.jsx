import { useEffect, useRef, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import toast from 'react-hot-toast';

const empty = { name:'', sku:'', barcode:'', category:'', brand:'', unit:'pcs', cost_price:0, price:0, tax_rate:18, stock:0, low_stock:5, expiry:'' };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const fileRef = useRef();

  const load = () => api.get('/api/products' + (q?`?q=${encodeURIComponent(q)}`:'')).then(setProducts);
  useEffect(() => { load(); }, [q]);

  const save = async () => {
    try {
      if (editing.id) await api.put(`/api/products/${editing.id}`, editing);
      else await api.post('/api/products', editing);
      toast.success('Saved');
      setEditing(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (p) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    await api.del(`/api/products/${p.id}`); load();
  };
  const doAdjust = async () => {
    await api.post(`/api/products/${adjust.product.id}/stock`, { type: adjust.type, qty: adjust.qty, reason: adjust.reason });
    toast.success('Stock updated');
    setAdjust(null); load();
  };
  const onImport = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const r = await api.upload('/api/products/import', f);
      toast.success(`Imported ${r.count} products`);
      load();
    } catch (e) { toast.error(e.message); }
    fileRef.current.value = '';
  };
  const exportCSV = () => {
    const headers = ['name','sku','barcode','category','brand','unit','cost_price','price','tax_rate','stock','low_stock'];
    const csv = [headers.join(','), ...products.map(p => headers.map(h => (p[h]??'')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'products.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-end">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input w-64" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn-secondary" onClick={()=>fileRef.current.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImport} />
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn-primary" onClick={()=>setEditing({...empty})}>+ Add Product</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>
            <th>Name</th><th>SKU</th><th>Barcode</th><th>Category</th><th className="text-right">Price</th>
            <th className="text-right">Stock</th><th>Tax</th><th></th>
          </tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="font-mono text-xs">{p.sku}</td>
                <td className="font-mono text-xs">{p.barcode}</td>
                <td>{p.category}</td>
                <td className="text-right">{fmt(p.price)}</td>
                <td className="text-right">
                  <span className={`badge ${p.stock<=0?'bg-red-100 text-red-700':p.stock<=p.low_stock?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{p.stock}</span>
                </td>
                <td>{p.tax_rate}%</td>
                <td className="space-x-2 text-xs">
                  <button onClick={()=>setAdjust({ product: p, type:'in', qty: 1, reason:'' })} className="text-brand-600 hover:underline">Stock</button>
                  <button onClick={()=>setEditing(p)} className="text-brand-600 hover:underline">Edit</button>
                  <button onClick={()=>del(p)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={()=>setEditing(null)} title={editing.id?'Edit Product':'New Product'}>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['name','Name','text'], ['sku','SKU','text'], ['barcode','Barcode','text'],
              ['category','Category','text'], ['brand','Brand','text'], ['unit','Unit','text'],
              ['cost_price','Cost Price (₹)','number'], ['price','Selling Price (₹)','number'],
              ['tax_rate','Tax %','number'], ['stock','Stock','number'], ['low_stock','Low-stock alert','number'],
              ['expiry','Expiry','date'],
            ].map(([k,l,t]) => (
              <div key={k} className={k==='name'?'col-span-2':''}>
                <label className="label">{l}</label>
                <input className="input" type={t} value={editing[k]??''} disabled={editing.id && k==='stock'}
                  onChange={e=>setEditing({...editing, [k]: t==='number'?+e.target.value:e.target.value})} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={()=>setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}

      {adjust && (
        <Modal onClose={()=>setAdjust(null)} title={`Stock — ${adjust.product.name}`}>
          <div className="space-y-3">
            <div className="text-sm">Current stock: <b>{adjust.product.stock}</b></div>
            <div><label className="label">Type</label>
              <select className="select" value={adjust.type} onChange={e=>setAdjust({...adjust, type:e.target.value})}>
                <option value="in">Stock In</option><option value="out">Stock Out</option>
                <option value="return">Return</option><option value="damage">Damage</option><option value="adjust">Adjust</option>
              </select>
            </div>
            <div><label className="label">Quantity</label>
              <input type="number" className="input" value={adjust.qty} onChange={e=>setAdjust({...adjust, qty:+e.target.value})} /></div>
            <div><label className="label">Reason / Note</label>
              <input className="input" value={adjust.reason} onChange={e=>setAdjust({...adjust, reason:e.target.value})} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={()=>setAdjust(null)}>Cancel</button>
            <button className="btn-primary" onClick={doAdjust}>Apply</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
