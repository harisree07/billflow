# BillFlow — Billing & Inventory Management System 

A complete billing , inventory , sales management web application that supports UPI QR payments,
printable invoices , CSV import/export , role-based authorization , charts,
and a sales dashboard. Mainly Designed for general retail shops in India.

Stack used --> React + Vite + Tailwind (frontend) · Node.js + Express + better-sqlite3 (backend) · JWT auth · Recharts · jsPDF · qrcode

## Quick start

```bash
# 1. Backend
cd server
cp .env.example .env (for windows use copy .env.example .env)
npm install
npm run seed     # creates ./data/billflow.db with demo data
npm run dev      # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev      # http://localhost:5173
```

Open http://localhost:5173 and log in:

| Role    | Email                | Password   |
|---------|----------------------|------------|
| Admin   | admin@billflow.in    | admin123   |
| Cashier | cashier@billflow.in  | cashier123 |
| Manager | manager@billflow.in  | manager123 |

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
- **Roles:** admin / manager / cashier with route guards.
- **Print:** A4 invoice + 80mm thermal receipt layouts, one-click print.
- **Extras:** dark mode, activity/audit log, expense tracking, daily closing,
  backup download (.db), demo seed data.

## Folder structure

```
billflow/
├── server/            Express API + SQLite
│   ├── src/
│   │   ├── index.js   server entry
│   │   ├── db.js      better-sqlite3 + schema
│   │   ├── auth.js    JWT + role middleware
│   │   ├── routes/    products, bills, customers, suppliers, reports, settings, expenses
│   │   └── seed.js    demo data
│   ├── data/          billflow.db (generated)
│   └── .env.example
├── client/            React + Vite + Tailwind
│   └── src/
│       ├── pages/     Login, Dashboard, Billing, Invoices, Inventory, Customers, Suppliers, Reports, Expenses, Settings, AuditLog
│       ├── components/ Layout, Sidebar, ProtectedRoute, etc.
│       └── lib/       api client, formatters
└── README.md
```

## Environment

`server/.env`:
```
PORT=4000
JWT_SECRET=change-me-in-production
```

`client/.env` (optional):
```
VITE_API_URL=http://localhost:4000
```

## Backup / restore

- **Backup:** Settings → Download Backup (saves `billflow.db`).
- **Restore:** stop server, replace `server/data/billflow.db`, restart.

## Production build

```bash
cd client && npm run build      # outputs client/dist
cd ../server && npm start       # serves API + client/dist
```

## License

MIT
