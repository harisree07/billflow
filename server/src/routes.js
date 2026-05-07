import express from 'express';
import bcrypt from 'bcryptjs';
import { db, logAudit } from './db.js';
import { signToken, authRequired, requireRole } from './auth.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbPath } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

export function mountRoutes(app) {
  // ---------- AUTH ----------
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!u || !bcrypt.compareSync(password || '', u.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(u);
    logAudit(u.id, 'login', 'user', u.id);
    res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  });

  app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: req.user }));

  app.get('/api/users', authRequired, requireRole('admin'), (req, res) => {
    res.json(db.prepare('SELECT id,name,email,role,created_at FROM users ORDER BY id').all());
  });
  app.post('/api/users', authRequired, requireRole('admin'), (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
    try {
      const r = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
        .run(name, email, bcrypt.hashSync(password, 10), role);
      logAudit(req.user.id, 'create', 'user', r.lastInsertRowid);
      res.json({ id: r.lastInsertRowid });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete('/api/users/:id', authRequired, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    logAudit(req.user.id, 'delete', 'user', req.params.id);
    res.json({ ok: true });
  });

  // ---------- SETTINGS ----------
  app.get('/api/settings', authRequired, (req, res) => {
    res.json(db.prepare('SELECT * FROM settings WHERE id=1').get());
  });
  app.put('/api/settings', authRequired, requireRole('admin','manager'), (req, res) => {
    const cur = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const m = { ...cur, ...req.body };
    db.prepare(`UPDATE settings SET business_name=?, address=?, phone=?, gstin=?, logo_url=?, upi_id=?, upi_payee=?, tax_rate=?, currency=?, invoice_prefix=?, low_stock_threshold=? WHERE id=1`)
      .run(m.business_name, m.address, m.phone, m.gstin, m.logo_url, m.upi_id, m.upi_payee, m.tax_rate, m.currency, m.invoice_prefix, m.low_stock_threshold);
    logAudit(req.user.id, 'update', 'settings', 1);
    res.json({ ok: true });
  });

  // ---------- PRODUCTS ----------
  app.get('/api/products', authRequired, (req, res) => {
    const q = (req.query.q || '').toString().trim();
    const rows = q
      ? db.prepare(`SELECT * FROM products WHERE active=1 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 50`)
          .all(`%${q}%`, `%${q}%`, `%${q}%`)
      : db.prepare('SELECT * FROM products WHERE active=1 ORDER BY name').all();
    res.json(rows);
  });
  app.get('/api/products/barcode/:code', authRequired, (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE barcode=? AND active=1').get(req.params.code);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  });
  app.post('/api/products', authRequired, requireRole('admin','manager'), (req, res) => {
    const p = req.body;
    try {
      const r = db.prepare(`INSERT INTO products (name,sku,barcode,category,brand,unit,cost_price,price,tax_rate,stock,low_stock,expiry)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(p.name, p.sku||null, p.barcode||null, p.category||null, p.brand||null, p.unit||'pcs',
             +p.cost_price||0, +p.price||0, +p.tax_rate||0, +p.stock||0, +p.low_stock||5, p.expiry||null);
      logAudit(req.user.id, 'create', 'product', r.lastInsertRowid);
      res.json({ id: r.lastInsertRowid });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.put('/api/products/:id', authRequired, requireRole('admin','manager'), (req, res) => {
    const p = req.body;
    db.prepare(`UPDATE products SET name=?,sku=?,barcode=?,category=?,brand=?,unit=?,cost_price=?,price=?,tax_rate=?,low_stock=?,expiry=? WHERE id=?`)
      .run(p.name, p.sku||null, p.barcode||null, p.category||null, p.brand||null, p.unit||'pcs',
           +p.cost_price||0, +p.price||0, +p.tax_rate||0, +p.low_stock||5, p.expiry||null, req.params.id);
    logAudit(req.user.id, 'update', 'product', req.params.id);
    res.json({ ok: true });
  });
  app.delete('/api/products/:id', authRequired, requireRole('admin','manager'), (req, res) => {
    db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
    logAudit(req.user.id, 'delete', 'product', req.params.id);
    res.json({ ok: true });
  });

  // Stock adjustment
  app.post('/api/products/:id/stock', authRequired, requireRole('admin','manager'), (req, res) => {
    const { type, qty, reason } = req.body;
    const delta = ['in','return'].includes(type) ? +qty : -Math.abs(+qty);
    db.transaction(() => {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(delta, req.params.id);
      db.prepare('INSERT INTO stock_movements (product_id,type,qty,reason,created_by) VALUES (?,?,?,?,?)')
        .run(req.params.id, type, +qty, reason||null, req.user.id);
    })();
    logAudit(req.user.id, 'stock_'+type, 'product', req.params.id, { qty, reason });
    res.json({ ok: true });
  });

  app.get('/api/stock-movements', authRequired, (req, res) => {
    res.json(db.prepare(`SELECT m.*, p.name as product_name FROM stock_movements m
      LEFT JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 200`).all());
  });

  // CSV import
  app.post('/api/products/import', authRequired, requireRole('admin','manager'), upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const text = req.file.buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',').map(h => h.trim().toLowerCase());
    const ix = (k) => headers.indexOf(k);
    const insert = db.prepare(`INSERT OR IGNORE INTO products (name,sku,barcode,category,brand,unit,cost_price,price,tax_rate,stock,low_stock)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    let count = 0;
    db.transaction(() => {
      for (const line of lines) {
        const c = line.split(',').map(x => x.trim());
        if (!c[ix('name')]) continue;
        insert.run(
          c[ix('name')],
          c[ix('sku')] || null,
          c[ix('barcode')] || null,
          c[ix('category')] || null,
          c[ix('brand')] || null,
          c[ix('unit')] || 'pcs',
          +c[ix('cost_price')] || 0,
          +c[ix('price')] || 0,
          +c[ix('tax_rate')] || 0,
          +c[ix('stock')] || 0,
          +c[ix('low_stock')] || 5,
        );
        count++;
      }
    })();
    logAudit(req.user.id, 'import', 'product', null, { count });
    res.json({ count });
  });

  // ---------- CUSTOMERS / SUPPLIERS ----------
  for (const t of ['customers','suppliers']) {
    app.get(`/api/${t}`, authRequired, (req, res) => {
      res.json(db.prepare(`SELECT * FROM ${t} ORDER BY name`).all());
    });
    app.post(`/api/${t}`, authRequired, (req, res) => {
      const p = req.body;
      const r = db.prepare(`INSERT INTO ${t} (name,phone,email,address,gstin) VALUES (?,?,?,?,?)`)
        .run(p.name, p.phone||null, p.email||null, p.address||null, p.gstin||null);
      logAudit(req.user.id, 'create', t, r.lastInsertRowid);
      res.json({ id: r.lastInsertRowid });
    });
    app.put(`/api/${t}/:id`, authRequired, (req, res) => {
      const p = req.body;
      db.prepare(`UPDATE ${t} SET name=?,phone=?,email=?,address=?,gstin=? WHERE id=?`)
        .run(p.name, p.phone||null, p.email||null, p.address||null, p.gstin||null, req.params.id);
      res.json({ ok: true });
    });
    app.delete(`/api/${t}/:id`, authRequired, requireRole('admin','manager'), (req, res) => {
      db.prepare(`DELETE FROM ${t} WHERE id=?`).run(req.params.id);
      res.json({ ok: true });
    });
  }

  // ---------- BILLS ----------
  function nextInvoiceNo() {
    const s = db.prepare('SELECT invoice_prefix FROM settings WHERE id=1').get();
    const prefix = (s?.invoice_prefix || 'INV');
    const last = db.prepare(`SELECT invoice_no FROM bills WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`).get(prefix+'%');
    let n = 1;
    if (last) {
      const m = last.invoice_no.match(/(\d+)$/);
      if (m) n = +m[1] + 1;
    }
    const y = new Date().getFullYear();
    return `${prefix}-${y}-${String(n).padStart(5,'0')}`;
  }

  app.get('/api/bills', authRequired, (req, res) => {
    const { from, to, status, customer, mode } = req.query;
    const where = []; const params = [];
    if (from) { where.push('date(created_at) >= date(?)'); params.push(from); }
    if (to)   { where.push('date(created_at) <= date(?)'); params.push(to); }
    if (status) { where.push('status=?'); params.push(status); }
    if (customer) { where.push('customer_id=?'); params.push(customer); }
    if (mode) { where.push('payment_mode=?'); params.push(mode); }
    const sql = `SELECT * FROM bills ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY id DESC LIMIT 500`;
    res.json(db.prepare(sql).all(...params));
  });

  app.get('/api/bills/:id', authRequired, (req, res) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id=?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id=?').all(bill.id);
    bill.payments = bill.payments_json ? JSON.parse(bill.payments_json) : [];
    res.json(bill);
  });

  app.post('/api/bills', authRequired, (req, res) => {
    const { customer_id, customer_name, customer_phone, items, discount = 0, payments = [], notes } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items' });
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const line = (+it.price) * (+it.qty);
      const ldisc = +it.discount || 0;
      const taxable = line - ldisc;
      subtotal += taxable;
      tax += taxable * (+it.tax_rate || 0) / 100;
    }
    const total = Math.round((subtotal + tax - (+discount||0)) * 100) / 100;
    const paid = payments.reduce((s,p) => s + (+p.amount||0), 0);
    const due = Math.max(0, total - paid);
    const payment_mode = payments.length === 1 ? payments[0].mode : (payments.length > 1 ? 'split' : null);
    const payment_status = paid <= 0 ? 'pending' : (paid >= total ? 'paid' : 'partial');

    const invoice_no = nextInvoiceNo();
    let billId;
    db.transaction(() => {
      const r = db.prepare(`INSERT INTO bills (invoice_no,customer_id,customer_name,customer_phone,subtotal,tax,discount,total,paid,due,payment_mode,payment_status,payments_json,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(invoice_no, customer_id||null, customer_name||null, customer_phone||null,
             subtotal, tax, +discount||0, total, paid, due, payment_mode, payment_status,
             JSON.stringify(payments), notes||null, req.user.id);
      billId = r.lastInsertRowid;
      const insItem = db.prepare(`INSERT INTO bill_items (bill_id,product_id,name,qty,price,tax_rate,discount,total) VALUES (?,?,?,?,?,?,?,?)`);
      const decStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id=?`);
      const movement = db.prepare(`INSERT INTO stock_movements (product_id,type,qty,reason,ref_type,ref_id,created_by) VALUES (?,?,?,?,?,?,?)`);
      for (const it of items) {
        const lineTotal = (+it.price)*(+it.qty) - (+it.discount||0);
        insItem.run(billId, it.product_id||null, it.name, +it.qty, +it.price, +it.tax_rate||0, +it.discount||0, lineTotal);
        if (it.product_id) {
          decStock.run(+it.qty, it.product_id);
          movement.run(it.product_id, 'out', +it.qty, 'Sale '+invoice_no, 'bill', billId, req.user.id);
        }
      }
      if (customer_id && due > 0) {
        db.prepare('UPDATE customers SET balance = balance + ? WHERE id=?').run(due, customer_id);
      }
    })();
    logAudit(req.user.id, 'create', 'bill', billId, { invoice_no, total });
    res.json({ id: billId, invoice_no });
  });

  app.post('/api/bills/:id/cancel', authRequired, requireRole('admin','manager'), (req, res) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id=?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    if (bill.status === 'cancelled') return res.json({ ok: true });
    db.transaction(() => {
      const items = db.prepare('SELECT * FROM bill_items WHERE bill_id=?').all(bill.id);
      const incStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id=?');
      const movement = db.prepare(`INSERT INTO stock_movements (product_id,type,qty,reason,ref_type,ref_id,created_by) VALUES (?,?,?,?,?,?,?)`);
      for (const it of items) {
        if (it.product_id) {
          incStock.run(it.qty, it.product_id);
          movement.run(it.product_id, 'return', it.qty, 'Bill cancel '+bill.invoice_no, 'bill', bill.id, req.user.id);
        }
      }
      db.prepare("UPDATE bills SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(bill.id);
      if (bill.customer_id && bill.due > 0) {
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id=?').run(bill.due, bill.customer_id);
      }
    })();
    logAudit(req.user.id, 'cancel', 'bill', bill.id);
    res.json({ ok: true });
  });

  app.post('/api/bills/:id/pay', authRequired, (req, res) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id=?').get(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    const { amount, mode } = req.body;
    const payments = bill.payments_json ? JSON.parse(bill.payments_json) : [];
    payments.push({ mode, amount: +amount, at: new Date().toISOString() });
    const paid = bill.paid + +amount;
    const due = Math.max(0, bill.total - paid);
    const status = due <= 0 ? 'paid' : 'partial';
    db.prepare(`UPDATE bills SET paid=?, due=?, payment_status=?, payments_json=?, updated_at=datetime('now') WHERE id=?`)
      .run(paid, due, status, JSON.stringify(payments), bill.id);
    if (bill.customer_id) {
      db.prepare('UPDATE customers SET balance = balance - ? WHERE id=?').run(+amount, bill.customer_id);
    }
    logAudit(req.user.id, 'payment', 'bill', bill.id, { amount, mode });
    res.json({ ok: true });
  });

  // ---------- REPORTS ----------
  app.get('/api/reports/summary', authRequired, (req, res) => {
    const { from, to } = req.query;
    const where = ["status='active'"]; const params = [];
    if (from) { where.push('date(created_at) >= date(?)'); params.push(from); }
    if (to)   { where.push('date(created_at) <= date(?)'); params.push(to); }
    const w = 'WHERE ' + where.join(' AND ');
    const totals = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue, COALESCE(SUM(tax),0) as tax, COALESCE(SUM(discount),0) as discount, COALESCE(SUM(due),0) as due FROM bills ${w}`).get(...params);
    const byDay = db.prepare(`SELECT date(created_at) as day, COALESCE(SUM(total),0) as revenue, COUNT(*) as bills FROM bills ${w} GROUP BY day ORDER BY day`).all(...params);
    const byMode = db.prepare(`SELECT COALESCE(payment_mode,'unpaid') as mode, COALESCE(SUM(total),0) as amount FROM bills ${w} GROUP BY mode`).all(...params);
    const top = db.prepare(`SELECT bi.name, SUM(bi.qty) as qty, SUM(bi.total) as revenue
      FROM bill_items bi JOIN bills b ON b.id=bi.bill_id ${w.replace('WHERE','WHERE')} 
      GROUP BY bi.name ORDER BY revenue DESC LIMIT 10`).all(...params);
    const lowStock = db.prepare(`SELECT id,name,stock,low_stock FROM products WHERE active=1 AND stock <= low_stock ORDER BY stock`).all();
    res.json({ totals, byDay, byMode, top, lowStock });
  });

  // ---------- EXPENSES ----------
  app.get('/api/expenses', authRequired, (req, res) => {
    res.json(db.prepare('SELECT * FROM expenses ORDER BY id DESC LIMIT 500').all());
  });
  app.post('/api/expenses', authRequired, (req, res) => {
    const { title, amount, category, notes } = req.body;
    const r = db.prepare('INSERT INTO expenses (title,amount,category,notes,created_by) VALUES (?,?,?,?,?)')
      .run(title, +amount, category||null, notes||null, req.user.id);
    logAudit(req.user.id, 'create', 'expense', r.lastInsertRowid);
    res.json({ id: r.lastInsertRowid });
  });
  app.delete('/api/expenses/:id', authRequired, requireRole('admin','manager'), (req, res) => {
    db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---------- AUDIT ----------
  app.get('/api/audit', authRequired, requireRole('admin','manager'), (req, res) => {
    res.json(db.prepare(`SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 500`).all());
  });

  // ---------- BACKUP ----------
  app.get('/api/backup', authRequired, requireRole('admin'), (req, res) => {
    res.download(dbPath, `billflow-${Date.now()}.db`);
  });
}
