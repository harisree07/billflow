import { supabase } from './supabaseClient.js';

// Facade implementing all previous local Express endpoints via Supabase Client SDK
export const api = {
  get: async (path) => {
    // 1. Users list
    if (path === '/api/users') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .order('created_at');
      if (error) throw error;
      return data || [];
    }

    // 2. Audit Log
    if (path === '/api/audit') {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, profiles(name)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      // Map profiles.name to user_name expected by UI
      return (data || []).map(r => ({
        ...r,
        user_name: r.profiles ? r.profiles.name : '—'
      }));
    }

    // 3. Settings
    if (path === '/api/settings') {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data;
    }

    // 4. Products search/list
    if (path.startsWith('/api/products')) {
      if (path.includes('/barcode/')) {
        // GET /api/products/barcode/:code
        const code = path.split('/barcode/')[1];
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', decodeURIComponent(code))
          .eq('active', true)
          .single();
        if (error) throw new Error('Product not found');
        return data;
      }

      // GET /api/products?q=...
      const url = new URL(path, 'http://localhost');
      const q = url.searchParams.get('q') || '';
      let query = supabase.from('products').select('*').eq('active', true);
      if (q.trim()) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
      }
      const { data, error } = await query.order('name').limit(50);
      if (error) throw error;
      return data || [];
    }

    // 5. Customers & Suppliers (t is 'customers' or 'suppliers')
    if (path.startsWith('/api/customers') || path.startsWith('/api/suppliers')) {
      const kind = path.includes('customers') ? 'customers' : 'suppliers';
      const { data, error } = await supabase
        .from(kind)
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    }

    // 6. Expenses
    if (path === '/api/expenses') {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('id', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    }

    // 7. Bills
    if (path.startsWith('/api/bills')) {
      const url = new URL(path, 'http://localhost');
      const parts = path.split('/');
      const isSingleBill = parts.length === 4 && !parts[3].includes('?'); // /api/bills/:id

      if (isSingleBill) {
        const id = parts[3];
        const { data, error } = await supabase
          .from('bills')
          .select('*, bill_items(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        return {
          ...data,
          items: data.bill_items || [],
          payments: data.payments || []
        };
      }

      // List bills with filters
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const status = url.searchParams.get('status');
      const customer = url.searchParams.get('customer');
      const mode = url.searchParams.get('mode');

      let query = supabase.from('bills').select('*');
      if (from) {
        query = query.gte('created_at', from + 'T00:00:00Z');
      }
      if (to) {
        query = query.lte('created_at', to + 'T23:59:59Z');
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (customer) {
        query = query.eq('customer_id', customer);
      }
      if (mode) {
        query = query.eq('payment_mode', mode);
      }
      const { data, error } = await query.order('id', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    }

    // 8. Reports Summary
    if (path.startsWith('/api/reports/summary')) {
      const url = new URL(path, 'http://localhost');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const { data, error } = await supabase.rpc('get_reports_summary', {
        p_from: from ? from + 'T00:00:00Z' : null,
        p_to: to ? to + 'T23:59:59Z' : null
      });
      if (error) throw error;
      return data;
    }

    // 9. Auth Me
    if (path === '/api/auth/me') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No session');
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      return { user: { ...session.user, ...profile } };
    }

    throw new Error(`GET Endpoint ${path} not implemented`);
  },

  post: async (path, body) => {
    // 1. Login
    if (path === '/api/auth/login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password
      });
      if (error) throw error;
      // Fetch profile to return role & metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', data.user.id)
        .single();

      // Log in audit trail
      try {
        await supabase.from('audit_log').insert({
          user_id: data.user.id,
          action: 'login',
          entity: 'user',
          entity_id: data.user.id
        });
      } catch (auditErr) {
        console.warn('Failed to insert login audit record:', auditErr);
      }

      return {
        token: data.session.access_token,
        user: { ...data.user, ...profile }
      };
    }

    // 2. Create User
    if (path === '/api/users') {
      const { data, error } = await supabase.rpc('create_new_user', {
        p_email: body.email,
        p_password: body.password,
        p_name: body.name,
        p_role: body.role
      });
      if (error) throw error;
      return { id: data };
    }

    // 3. Create Product
    if (path === '/api/products') {
      const { id, created_at, active, ...insertData } = body;
      const { data, error } = await supabase
        .from('products')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'create',
        entity: 'product',
        entity_id: data.id.toString()
      });

      return { id: data.id };
    }

    // 4. Stock Adjustment
    if (path.startsWith('/api/products/') && path.endsWith('/stock')) {
      const parts = path.split('/');
      const productId = parts[3];
      const { error } = await supabase.rpc('adjust_stock', {
        p_product_id: parseInt(productId, 10),
        p_type: body.type,
        p_qty: parseFloat(body.qty),
        p_reason: body.reason || null
      });
      if (error) throw error;
      return { ok: true };
    }

    // 5. Create Stakeholder (Customers/Suppliers)
    if (path === '/api/customers' || path === '/api/suppliers') {
      const kind = path.includes('customers') ? 'customers' : 'suppliers';
      const { id, created_at, balance, ...insertData } = body;
      const { data, error } = await supabase
        .from(kind)
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'create',
        entity: kind,
        entity_id: data.id.toString()
      });

      return { id: data.id };
    }

    // 6. Create Expense
    if (path === '/api/expenses') {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          title: body.title,
          amount: parseFloat(body.amount),
          category: body.category || null,
          notes: body.notes || null,
          created_by: user.id
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'create',
        entity: 'expense',
        entity_id: data.id.toString()
      });

      return { id: data.id };
    }

    // 7. Create Invoice (Bill)
    if (path === '/api/bills') {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('create_bill', {
        p_customer_id: body.customer_id || null,
        p_customer_name: body.customer_name || null,
        p_customer_phone: body.customer_phone || null,
        p_items: body.items,
        p_discount: parseFloat(body.discount) || 0,
        p_payments: body.payments || [],
        p_notes: body.notes || null,
        p_created_by: user.id
      });
      if (error) throw error;
      return data; // returns { id: billId, invoice_no }
    }

    // 8. Cancel Bill
    if (path.startsWith('/api/bills/') && path.endsWith('/cancel')) {
      const parts = path.split('/');
      const billId = parts[3];
      const { error } = await supabase
        .from('bills')
        .update({ status: 'cancelled' })
        .eq('id', parseInt(billId, 10));
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'cancel',
        entity: 'bill',
        entity_id: billId
      });

      return { ok: true };
    }

    // 9. Pay Bill
    if (path.startsWith('/api/bills/') && path.endsWith('/pay')) {
      const parts = path.split('/');
      const billId = parts[3];
      const { error } = await supabase.rpc('pay_bill', {
        p_bill_id: parseInt(billId, 10),
        p_amount: parseFloat(body.amount),
        p_mode: body.mode
      });
      if (error) throw error;
      return { ok: true };
    }

    throw new Error(`POST Endpoint ${path} not implemented`);
  },

  put: async (path, body) => {
    // 1. Settings Update
    if (path === '/api/settings') {
      const { id, ...updateData } = body;
      const { error } = await supabase
        .from('settings')
        .update(updateData)
        .eq('id', 1);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update',
        entity: 'settings',
        entity_id: '1'
      });

      return { ok: true };
    }

    // 2. Product Update
    if (path.startsWith('/api/products/')) {
      const parts = path.split('/');
      const productId = parts[3];
      const { id, created_at, active, ...updateData } = body;
      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', parseInt(productId, 10));
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update',
        entity: 'product',
        entity_id: productId
      });

      return { ok: true };
    }

    // 3. Stakeholder Update (Customer/Supplier)
    if (path.startsWith('/api/customers/') || path.startsWith('/api/suppliers/')) {
      const kind = path.includes('customers') ? 'customers' : 'suppliers';
      const parts = path.split('/');
      const entityId = parts[3];
      const { id, created_at, balance, ...updateData } = body;
      const { error } = await supabase
        .from(kind)
        .update(updateData)
        .eq('id', parseInt(entityId, 10));
      if (error) throw error;

      return { ok: true };
    }

    throw new Error(`PUT Endpoint ${path} not implemented`);
  },

  del: async (path) => {
    // 1. Delete User (Profile + Auth User via RPC)
    if (path.startsWith('/api/users/')) {
      const parts = path.split('/');
      const userId = parts[3];
      const { error } = await supabase.rpc('delete_user', {
        p_user_id: userId
      });
      if (error) throw error;
      return { ok: true };
    }

    // 2. Soft Delete Product
    if (path.startsWith('/api/products/')) {
      const parts = path.split('/');
      const productId = parts[3];
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', parseInt(productId, 10));
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'delete',
        entity: 'product',
        entity_id: productId
      });

      return { ok: true };
    }

    // 3. Delete Stakeholder (Customer/Supplier)
    if (path.startsWith('/api/customers/') || path.startsWith('/api/suppliers/')) {
      const kind = path.includes('customers') ? 'customers' : 'suppliers';
      const parts = path.split('/');
      const entityId = parts[3];
      const { error } = await supabase
        .from(kind)
        .delete()
        .eq('id', parseInt(entityId, 10));
      if (error) throw error;

      return { ok: true };
    }

    // 4. Delete Expense
    if (path.startsWith('/api/expenses/')) {
      const parts = path.split('/');
      const expenseId = parts[3];
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', parseInt(expenseId, 10));
      if (error) throw error;

      return { ok: true };
    }

    throw new Error(`DELETE Endpoint ${path} not implemented`);
  },

  upload: async (path, file) => {
    // CSV Import: Parse client-side and bulk upsert
    if (path === '/api/products/import') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) throw new Error('CSV is empty');

      const headers = lines.shift().split(',').map(h => h.trim().toLowerCase());
      const ix = (k) => headers.indexOf(k);

      const rowsToInsert = [];
      for (const line of lines) {
        const c = line.split(',').map(x => x.trim());
        if (!c[ix('name')]) continue;
        rowsToInsert.push({
          name: c[ix('name')],
          sku: c[ix('sku')] || null,
          barcode: c[ix('barcode')] || null,
          category: c[ix('category')] || null,
          brand: c[ix('brand')] || null,
          unit: c[ix('unit')] || 'pcs',
          cost_price: parseFloat(c[ix('cost_price')]) || 0,
          price: parseFloat(c[ix('price')]) || 0,
          tax_rate: parseFloat(c[ix('tax_rate')]) || 0,
          stock: parseFloat(c[ix('stock')]) || 0,
          low_stock: parseInt(c[ix('low_stock')], 10) || 5,
        });
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from('products')
          .upsert(rowsToInsert, { onConflict: 'sku' });
        if (error) throw error;

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'import',
          entity: 'product',
          meta: JSON.stringify({ count: rowsToInsert.length })
        });
      }

      return { count: rowsToInsert.length };
    }

    throw new Error(`Upload Endpoint ${path} not implemented`);
  },

  download: async (path, filename) => {
    // Supabase DB JSON Data backup
    if (path === '/api/backup') {
      const { data: settings } = await supabase.from('settings').select('*');
      const { data: products } = await supabase.from('products').select('*');
      const { data: customers } = await supabase.from('customers').select('*');
      const { data: suppliers } = await supabase.from('suppliers').select('*');

      const backupObj = {
        settings: settings || [],
        products: products || [],
        customers: customers || [],
        suppliers: suppliers || [],
        backed_up_at: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billflow-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    throw new Error(`Download Endpoint ${path} not implemented`);
  }
};

export const fmt = (n) => '₹' + (Number(n)||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (d) => d ? new Date(d.includes('T')?d:d.replace(' ','T')).toLocaleString('en-IN') : '';
export const today = () => new Date().toISOString().slice(0,10);
export const daysAgo = (n) => new Date(Date.now() - n*86400000).toISOString().slice(0,10);
