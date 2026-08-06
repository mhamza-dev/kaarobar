# Kaarobar Offline Desktop

Single-shop, fully offline desktop POS after license activation. **One-time purchase** commercial edition (distinct from **Kaarobar Cloud** subscription).

Publisher: **2ndHub Solutions**. Product name remains **Kaarobar**.

Authoritative requirements: [`docs/srs/KRB-SRS-004.md`](srs/KRB-SRS-004.md) §10.6 (`ODE-FR-*`) · Index: [`docs/requirements-index.md`](requirements-index.md).

**Implementation package in this monorepo:** [`kaarobar-desktop-offline/`](../kaarobar-desktop-offline/) (Electron + React + local SQLite). Package README: [`kaarobar-desktop-offline/README.md`](../kaarobar-desktop-offline/README.md).

> **Not** the same as Cloud Desktop sync (`OFF-FR-*`). Cloud Desktop lives in [`kaarobar-desktop/`](../kaarobar-desktop/) — it queues sales and syncs to the multi-tenant Phoenix API. Offline Desktop keeps day-to-day data in local SQLite and does **not** require cloud for selling after license activation.

---

## Who it is for

Shop owners, managers, and cashiers who need a **desktop POS** that:

- Works **offline** after license activation
- Fits **one shop** (one business per install)
- Supports **English and Urdu** (Urdu with RTL layout)
- Keeps **cash, card/online, and khata** sales in one place
- Matches the shop’s vertical (retail / food / salon / services)

---

## Feature list & how it helps

### 1. Business type–aware POS

| What you get | How it helps |
|---|---|
| Nature chosen once in **Setup** (retail, food, salon, services) | Catalog and POS match how the shop actually works |
| **Retail** — stocked items, overstock blocked when tracked | Classic shop counter without unused restaurant/salon controls |
| **Food** — dining tables, dine-in / takeaway / delivery, open tickets | Floor and ticket flow for restaurants and cafés |
| **Salon / services** — required **Served by** staff on sale | Know who entertained the customer |
| Product **kinds** filtered by nature (item, deal, service, package) | No irrelevant kind options; stock only when the product tracks stock |

**Outcome:** Staff only see controls that matter; less clutter and fewer mistakes.

---

### 2. Fast checkout (POS)

| What you get | How it helps |
|---|---|
| Barcode scan or tap-to-add products | Faster billing, fewer typing mistakes |
| Full-height product wall + sticky cart; **Create Sale** always visible | No scrolling past the fold to finish a sale |
| Cash, **Card / Online**, or khata payment | Match how Pakistani shops get paid |
| Overstock highlight + block for stock-tracked products | Prevent selling more than you have |
| Print / reprint receipts (layout follows EN or UR) | Customer proof in the language the shop uses |

**Outcome:** Cashiers complete sales quickly even when internet is down.

---

### 3. Offline-first shop data

| What you get | How it helps |
|---|---|
| Local SQLite database on the PC | No waiting on a cloud API for each sale |
| License once via internet, then work offline | Reliable during outages and weak connectivity |

**Outcome:** Sales keep flowing; the shop does not stop when Wi‑Fi fails.

---

### 4. Dashboard & insights

| What you get | How it helps |
|---|---|
| KPIs (sales, payments, khata outstanding, low stock) | See shop health at a glance |
| Four interactive charts — revenue, transactions, payment mix, top products | Spot trends without exporting to Excel |
| Range: **7 / 30 / 90** days | Compare short vs longer performance |
| Large amounts in **Lakh / Crore** when they cross thresholds | Easier reading for PKR-scale totals |
| Low-stock KPI focuses on products that **track stock** | Meaningful for mixed service + retail catalogs |

**Outcome:** Owners decide restocking, promotions, and credit follow-ups with real numbers.

---

### 5. Products & stock

| What you get | How it helps |
|---|---|
| Product catalog with price, barcode/SKU, images | One source of truth for what you sell |
| Kind + **tracks stock** (hidden when not applicable) | Services/deals don’t force fake inventory |
| Low-stock visibility on the dashboard | Avoid “out of stock” surprises at the counter |
| Stock updates from sales and purchase receive | Inventory stays aligned with reality |

**Outcome:** Less overselling and fewer stock-count fights at month end.

---

### 6. Food: tables & tickets

| What you get | How it helps |
|---|---|
| **Tables** admin (food only) — name, seats, active | Manage the floor without paper lists |
| Free vs Occupied from open tickets | See which tables need attention |
| POS: choose dine-in / takeaway / delivery | Correct service mode on every sale |
| Open ticket → bill → sale | Hold orders at the table until payment |

**Outcome:** Restaurant-style flow without bolting on unused retail-only screens.

---

### 7. Suppliers & purchase orders

| What you get | How it helps |
|---|---|
| Supplier profiles and linked products | Know who supplies what, and at what cost |
| Purchase orders and receive flow | Track orders and increase stock when goods arrive |
| Printable POs (EN/UR layout) | Share clear orders with suppliers |

**Outcome:** Purchasing is documented instead of living only in notebooks or WhatsApp chats.

---

### 8. Sales history

| What you get | How it helps |
|---|---|
| Searchable sales history | Find invoices for refunds or disputes |
| Sale detail shows table / mode / served-by **only when set** | No empty labels for other verticals |
| Refunds / voids (by role) with stock restore where applicable | Correct mistakes without silent stock errors |

**Outcome:** History is audit-friendly and easy to revisit.

---

### 8b. Customers & khata

| What you get | How it helps |
|---|---|
| Dedicated Customers page | Manage profiles without mixing them into sales history |
| Customer balances and ledger | Track who owes what, and every in/out |
| Classic debit / credit ledger with date filter | Read khata like a paper book |
| Print ledger (selected dates, or full if none) | Share or archive customer statements |
| Khata (pay later) sales with balance updates | Serve regulars safely without losing track of credit |
| Record customer payments against outstanding balance | Collect credit without guessing remaining dues |

**Outcome:** Credit is controlled; follow-up lives in one place.

---

### 9. Staff & access control

| What you get | How it helps |
|---|---|
| Roles: owner, admin, manager, cashier | Right people see right screens |
| Create / edit / deactivate users | Control who can sell, refund, or change settings |
| Table filters as a compact dropdown (not a modal over the grid) | Filter lists without covering the data |

**Outcome:** A cashier cannot change business settings or approve sensitive actions they should not touch.

---

### 10. Business branding & settings

| What you get | How it helps |
|---|---|
| Shop name, currency, logo | Professional receipts and on-screen identity |
| Preset brand colors with readable button text | Theme matches the shop without broken contrast |
| Social links (WhatsApp, Instagram, etc.) for receipts | Customers can reach you from printed receipts |
| Branch contact details | Address / phone stay consistent on paperwork |
| Glass cards & modals aligned with brand | Modern, readable UI without clutter |

**Outcome:** The app looks like *your* shop, not a generic template.

---

### 11. Encrypted backup & restore

| What you get | How it helps |
|---|---|
| Encrypted `.kaarobar-backup` (database **+** product images / logos) | Full shop recovery, not just numbers |
| Progress bar while creating or restoring | Clear feedback on longer media-heavy backups |
| **Auto-backup** — enable + daily time (while the app is open) | Scheduled safety without remembering to click Backup |
| Restore from Backup page or during setup | Recover after hardware change or reinstall |
| Setup choice: **Fresh** shop or **Restore** from backup | New PC can continue the same shop |
| Older DB-only backups still restore | Compatibility with previous backup files |

**Outcome:** Data and media loss risk drops; moving to a new computer is manageable.

---

### 12. Daily reminders & license lockout

| What you get | How it helps |
|---|---|
| **Reminders on each login** | Fresh restock + license notes whenever staff sign in |
| Header **Reminders** list (no toast spam) | Check alerts when convenient without interrupting checkout |
| Restock advisories from recent sales velocity | Restock before shelves run dry |
| License expiring within **7 days** (or already expired) | Time to renew before selling stops |
| Expired license **blocks POS, products, and sales** (including mid-session) | No selling on an invalid license; lifetime licenses never lock |

**Outcome:** Owners see restock and renewal needs early; expired installs cannot keep ringing sales.

---

### 13. Language, fonts & print

| What you get | How it helps |
|---|---|
| Full UI in EN or UR | Staff use the language they prefer |
| Urdu with right-to-left layout | Comfortable reading and navigation |
| **Poppins** (English) and **Noto Sans Arabic** (Urdu) | Clear typography for dense POS screens |
| Receipts & PO prints follow EN/UR (font, RTL, labels) | Printed paper matches the shop language |
| Print preview before every print | Confirm layout, then print from the preview toolbar |

**Outcome:** Less training friction for mixed-language teams; paperwork stays consistent.

---

### 14. Desktop installers for clients

| What you get | How it helps |
|---|---|
| macOS DMG, Windows Setup / Portable, Linux AppImage | Install on common shop PCs |
| Portable Windows build | Try or run without a full install when needed |

**Outcome:** Easy to deploy to client machines without a web browser dependency.

---

## Everyday workflows (examples)

1. **Morning open** — Cashier logs in → POS → scan items → take cash / card-online / khata → print receipt.
2. **Food service** — Choose dine-in → open table ticket → add items → bill when ready.
3. **Salon visit** — Add services → select **Served by** → confirm payment.
4. **Owner check-in** — Dashboard → pick 7 or 30 days → review top products and khata outstanding.
5. **Restock** — Create / receive a purchase order → stock increases → products ready at POS.
6. **Credit follow-up** — Open **Customers** → customer detail → see balance and ledger → record payment (per shop policy).
7. **Safety net** — Enable daily auto-backup (or Create backup now) → keep a copy off the shop PC.
8. **Reminders** — Sign in → open header **Reminders** for restock / license notes.

---

## What Kaarobar Offline Desktop is *not* (current stage)

- **Not** multi-branch cloud sync across many shops in one login (single shop per install).
- **Not** a browser SaaS — it is a **desktop** app with local data.
- **Not** a free-form brand color picker — curated brand presets keep contrast readable.
- Business **nature** is set at setup (not edited daily in Business Settings).
- Auto-backup runs **while Kaarobar is open** on that PC (not a background Windows/Mac service).
- Day-to-day selling does **not** require constant internet after license activation.
- Food hospitality **in scope** (Must): kitchen display / KOT (`FUT-FR-001`), split bill (`FUT-FR-002`), delivery rider status (`FUT-FR-004`), happy-hour pricing (`FUT-FR-008`).

---

## Related docs

| Doc | Purpose |
|---|---|
| [KRB-SRS-004 §10.6](srs/KRB-SRS-004.md) | Authoritative `ODE-FR-*` requirements |
| [requirements-index.md](requirements-index.md) | Stable ID prefixes |
| [README.md](../README.md) | Product snapshot, setup, clients |
| [`kaarobar-desktop-offline/README.md`](../kaarobar-desktop-offline/README.md) | Dev/build/env for the Offline Desktop package |
| Cloud Desktop sync | SRS §10.5 `OFF-FR-*` · package [`kaarobar-desktop`](../kaarobar-desktop/) |

---

*Kaarobar Offline Desktop is a product of 2ndHub Solutions.*
