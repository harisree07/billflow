import { useEffect, useState } from 'react';
import { api, fmtDate } from '../lib/api.js';

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/api/audit').then(setRows); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Meta</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.user_name || '—'}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td>{r.entity}</td>
                <td>{r.entity_id}</td>
                <td className="font-mono text-xs truncate max-w-xs">{r.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
