# BillFlow — Billing & Inventory Management System 

A complete billing, inventory, sales management web application that supports UPI QR payments,
printable invoices, CSV import/export, role-based authorization, charts,
and a sales dashboard. Mainly Designed for general retail shops in India.

**Stack:** React + Vite + Tailwind (frontend) · Supabase (backend as a service) · PostgreSQL (database) · RLS Security & Triggers · Recharts · jsPDF · qrcode

---

## Quick Start (Supabase Setup)

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project named `BillFlow`.
2. Once created, navigate to **Settings** (gear icon) -> **API** -> Copy your **Project URL** and your **Legacy anon public key** (starts with `eyJ...`).

### 2. Setup the Database
1. In the Supabase dashboard sidebar, click on **SQL Editor**.
2. Click **New query**.
3. Locate the `schema.sql` file in the project (or copy the contents from your setup notes) and run the script. This creates all tables, triggers, RPC functions, and seeds your default products and login accounts.
4. Go to **Authentication** -> **Users** and click **Add User** -> **Create User** to register:
   * **Email**: `admin@billflow.in`
   * **Password**: `admin123`
   * Ensure **Auto-confirm User** is turned on.
5. Elevate the user role in the SQL editor:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@billflow.in';
   ```

### 3. Start the Frontend
1. Navigate into the client directory:
   ```bash
   cd client
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example .env (for windows use: copy .env.example .env)
   ```
3. Open `client/.env` and paste your Supabase keys:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (your long copied legacy key)
   ```
4. Install packages and start the Vite dev server:
   ```bash
   npm install --legacy-peer-deps
   npm run dev      # http://localhost:5173
   ```

---

## Seed Credentials

| Role    | Email                | Password   |
|---------|----------------------|------------|
| Admin   | admin@billflow.in    | admin123   |
| Manager | manager@billflow.in  | manager123 |
| Cashier | cashier@billflow.in  | cashier123 |

*(Note: Ensure you create these accounts in Supabase Auth first, then set their roles in the `public.profiles` database table using SQL or the dashboard UI).*

---

## Features

- **Billing:** product search, barcode entry, multi-payment (cash/card/UPI/bank/split),
  auto tax+discount, invoice numbering, save/edit/cancel with audit log, reprint.
- **Inventory:** manual + CSV bulk import, real-time stock sync, low/out-of-stock
  alerts, categories, units, brands, SKU, barcode, expiry, stock adjustments.
- **Sales reports:** day/week/month/year summaries, top products, charts,
  PDF + CSV export, filters (date/customer/product/category/payment).
- **UPI QR:** configurable UPI ID — every invoice shows a scannable UPI QR with
  exact amount, payee name, and txn note.
- **Customers & suppliers:** records with purchase history & dues.
- **Multi-purpose:** configurable tax %, business name, logo, address, GSTIN.
- **Roles:** admin / manager / cashier with route guards (Row-Level Security enforced).
- **Print:** A4 invoice + 80mm thermal receipt layouts, one-click print.
- **Extras:** dark mode, activity/audit log, expense tracking, backup download (JSON), demo seed data.

---

## Folder Structure

```
billflow/
├── client/            React + Vite + Tailwind
│   └── src/
│       ├── pages/     Login, Dashboard, Billing, Invoices, Inventory, Customers, Suppliers, Reports, Expenses, Settings, AuditLog
│       ├── components/ Layout, Sidebar, ProtectedRoute, etc.
│       ├── context/   AuthContext
│       └── lib/       api client facade, supabaseClient, formatters
├── schema.sql         Supabase SQL Schema & Seed Database script
└── README.md
```

---

## Backup / Restore

- **Backup:** Settings → Download Backup (downloads the database snapshot as a `.json` backup file containing settings, products, customers, and suppliers).
- **Restore:** Managed directly through your Supabase account backup portal.

---

## Production Build

Since this is now a static client-side application (SPA), you can host the build folder (`client/dist`) directly on Vercel, Netlify, GitHub Pages, or Supabase Hosting with zero server costs:

```bash
cd client
npm run build      # outputs client/dist
```

---

## License

MIT
