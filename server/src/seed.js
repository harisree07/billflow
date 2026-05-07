import bcrypt from 'bcryptjs';
import { db, initSchema } from './db.js';

initSchema();

console.log('Seeding demo data...');

// Wipe existing demo data (idempotent re-seed)
db.exec(`DELETE FROM bill_items; DELETE FROM bills; DELETE FROM stock_movements;
         DELETE FROM expenses; DELETE FROM audit_log; DELETE FROM products;
         DELETE FROM customers; DELETE FROM suppliers; DELETE FROM users;`);

const insUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
insUser.run('Admin User',   'admin@billflow.in',   bcrypt.hashSync('admin123', 10),   'admin');
insUser.run('Manager User', 'manager@billflow.in', bcrypt.hashSync('manager123', 10), 'manager');
insUser.run('Cashier User', 'cashier@billflow.in', bcrypt.hashSync('cashier123', 10), 'cashier');

const products = [
  ['Aashirvaad Atta 5kg',     'SKU-ATTA5',    '8901030001234', 'Grocery',     'Aashirvaad', 'pcs', 240, 285, 5, 40],
  ['Tata Salt 1kg',           'SKU-SALT1',    '8901030005678', 'Grocery',     'Tata',       'pcs', 18,  28,  5, 120],
  ['Amul Butter 500g',        'SKU-BTR500',   '8901030009999', 'Dairy',       'Amul',       'pcs', 240, 285, 12, 25],
  ['Britannia Marie 250g',    'SKU-BRM250',   '8901030011223', 'Snacks',      'Britannia',  'pcs', 22,  35,  5, 80],
  ['Maggi Noodles 70g',       'SKU-MAGGI70',  '8901030013344', 'Snacks',      'Nestle',     'pcs', 9,   14,  5, 200],
  ['Colgate MaxFresh 150g',   'SKU-COL150',   '8901030015566', 'Personal',    'Colgate',    'pcs', 75,  110, 5, 35],
  ['Dettol Soap 125g',        'SKU-DET125',   '8901030017788', 'Personal',    'Dettol',     'pcs', 28,  45,  5, 60],
  ['Surf Excel 1kg',          'SKU-SURF1',    '8901030019900', 'Household',   'Surf',       'pcs', 145, 180, 5, 22],
  ['Coca Cola 750ml',         'SKU-COKE750',  '8901030022211', 'Beverages',   'Coca-Cola',  'pcs', 30,  45,  5, 90],
  ['Lays Classic 52g',        'SKU-LAYS52',   '8901030024422', 'Snacks',      'Lays',       'pcs', 12,  20,  5, 150],
  ['Parle-G 800g',            'SKU-PARLE800', '8901030026633', 'Snacks',      'Parle',      'pcs', 60,  90,  5, 45],
  ['Tata Tea Gold 500g',      'SKU-TEA500',   '8901030028844', 'Beverages',   'Tata',       'pcs', 240, 295, 5, 30],
  ['Fortune Sunflower Oil 1L','SKU-OIL1',     '8901030030055', 'Grocery',     'Fortune',    'pcs', 145, 175, 5, 50],
  ['Basmati Rice 5kg',        'SKU-RICE5',    '8901030032266', 'Grocery',     'India Gate', 'pcs', 480, 595, 5, 28],
  ['Dairy Milk Silk 60g',     'SKU-DM60',     '8901030034477', 'Snacks',      'Cadbury',    'pcs', 65,  90,  5, 70],
];
const insP = db.prepare(`INSERT INTO products (name,sku,barcode,category,brand,unit,cost_price,price,tax_rate,stock,low_stock) VALUES (?,?,?,?,?,?,?,?,?,?,5)`);
products.forEach(p => insP.run(...p));

const customers = [
  ['Rahul Sharma', '+91 98765 43210', 'rahul@example.com', '12 Park Street, Kolkata',  null],
  ['Priya Patel',  '+91 99887 76655', 'priya@example.com', '45 Linking Road, Mumbai',  null],
  ['Walk-in Customer', '', '', '', null],
];
const insC = db.prepare('INSERT INTO customers (name,phone,email,address,gstin) VALUES (?,?,?,?,?)');
customers.forEach(c => insC.run(...c));

const suppliers = [
  ['Reliance Wholesale', '+91 22 1234 5678', 'orders@rel.in', 'Andheri East, Mumbai', '27AAACR1234A1Z5'],
  ['Metro Cash & Carry', '+91 80 9876 5432', 'b2b@metro.in',  'Whitefield, Bengaluru', '29AAFCM5678B1Z9'],
];
const insS = db.prepare('INSERT INTO suppliers (name,phone,email,address,gstin) VALUES (?,?,?,?,?)');
suppliers.forEach(s => insS.run(...s));

// A few demo bills across the past 14 days
const allProducts = db.prepare('SELECT * FROM products').all();
const allCustomers = db.prepare('SELECT * FROM customers').all();
const modes = ['cash','upi','card','upi','cash'];
const insBill = db.prepare(`INSERT INTO bills (invoice_no,customer_id,customer_name,customer_phone,subtotal,tax,discount,total,paid,due,payment_mode,payment_status,payments_json,created_by,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insBI = db.prepare(`INSERT INTO bill_items (bill_id,product_id,name,qty,price,tax_rate,discount,total) VALUES (?,?,?,?,?,?,?,?)`);
const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id=?');
const insMv = db.prepare(`INSERT INTO stock_movements (product_id,type,qty,reason,ref_type,ref_id,created_by) VALUES (?,?,?,?,?,?,?)`);

let invCount = 1;
for (let d = 14; d >= 0; d--) {
  const billsToday = 1 + Math.floor(Math.random()*4);
  for (let b = 0; b < billsToday; b++) {
    const cust = allCustomers[Math.floor(Math.random()*allCustomers.length)];
    const mode = modes[Math.floor(Math.random()*modes.length)];
    const itemCount = 1 + Math.floor(Math.random()*4);
    let subtotal = 0, tax = 0;
    const items = [];
    for (let i = 0; i < itemCount; i++) {
      const p = allProducts[Math.floor(Math.random()*allProducts.length)];
      const qty = 1 + Math.floor(Math.random()*3);
      const lineTotal = p.price * qty;
      subtotal += lineTotal;
      tax += lineTotal * p.tax_rate / 100;
      items.push({ p, qty, lineTotal });
    }
    const total = Math.round((subtotal + tax) * 100)/100;
    const created_at = new Date(Date.now() - d*86400000 - Math.random()*86400000*0.8).toISOString().replace('T',' ').slice(0,19);
    const invoice_no = `INV-${new Date().getFullYear()}-${String(invCount++).padStart(5,'0')}`;
    const payments = [{ mode, amount: total, at: created_at }];
    const r = insBill.run(invoice_no, cust.id, cust.name, cust.phone, subtotal, tax, 0, total, total, 0, mode, 'paid', JSON.stringify(payments), 1, created_at);
    for (const it of items) {
      insBI.run(r.lastInsertRowid, it.p.id, it.p.name, it.qty, it.p.price, it.p.tax_rate, 0, it.lineTotal);
      decStock.run(it.qty, it.p.id);
      insMv.run(it.p.id, 'out', it.qty, 'Sale '+invoice_no, 'bill', r.lastInsertRowid, 1);
    }
  }
}

db.prepare('INSERT INTO expenses (title,amount,category,created_by) VALUES (?,?,?,?)').run('Shop rent', 25000, 'Rent', 1);
db.prepare('INSERT INTO expenses (title,amount,category,created_by) VALUES (?,?,?,?)').run('Electricity', 3200, 'Utilities', 1);

console.log('Seed complete. Demo logins:');
console.log('  admin@billflow.in   / admin123');
console.log('  manager@billflow.in / manager123');
console.log('  cashier@billflow.in / cashier123');
