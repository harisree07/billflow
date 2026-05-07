const API = import.meta.env.VITE_API_URL || '';

function tokenHeader() {
  const t = localStorage.getItem('bf_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.blob();
}

export const api = {
  get: (path) => fetch(API + path, { headers: { ...tokenHeader() } }).then(handle),
  post: (path, body) => fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(body),
  }).then(handle),
  put: (path, body) => fetch(API + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(body),
  }).then(handle),
  del: (path) => fetch(API + path, { method: 'DELETE', headers: { ...tokenHeader() } }).then(handle),
  upload: (path, file) => {
    const fd = new FormData(); fd.append('file', file);
    return fetch(API + path, { method: 'POST', headers: { ...tokenHeader() }, body: fd }).then(handle);
  },
  download: async (path, filename) => {
    const res = await fetch(API + path, { headers: { ...tokenHeader() } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

export const fmt = (n) => '₹' + (Number(n)||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (d) => d ? new Date(d.includes('T')?d:d.replace(' ','T')).toLocaleString('en-IN') : '';
export const today = () => new Date().toISOString().slice(0,10);
export const daysAgo = (n) => new Date(Date.now() - n*86400000).toISOString().slice(0,10);
