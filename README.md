# Kaarobar

POS, accounting, and payroll for owners who run more than one business—and often more than one branch in each.

Internal planning reference: **[KRB-SRS-003](docs/srs/KRB-SRS-003.md)** v3.1 Production Baseline (ISO/IEC/IEEE 29148:2018; supersedes KRB-SRS-002). Stack: Elixir/Phoenix + PostgreSQL + Oban.

Kaarobar is multi-tenant SaaS. Owner → business → branch isn’t an afterthought—it’s how the product is structured.

## What it covers

1. **Point of Sale** — Fast sales, returns, khata, loyalty points, offline desktop tills
2. **Accounting** — Real double-entry books under the POS (not a cash notebook)
3. **HR & Payroll** — Attendance, leave, payroll, ESS
4. **CRM (baseline)** — Email/in-app campaigns, audience filters, loyalty points
5. **Platform** — Plan limits, LemonSqueezy hooks, FBR hooks, push/email, en/ur
6. **Roadmap** — Helpdesk · Public API · BI · appointments · production FBR adapter · full billing portal

## Goals

| ID | Goal |
|----|------|
| G1 | Less hustle for the owner — one view of sales, cash, stock, and staff |
| G2 | Real accounting — sales, purchases, and payroll post balanced journals |
| G3 | Branches that can work alone, with the owner still in control (including offline POS) |
| G4 | Pakistan-ready (FBR Tier-1 + configurable tax) |
| G5 | Keep early operating cost low (shared DB, modular monolith) |
| G6 | Customer engagement & retention |
| G7 | Platform extensibility via API |

## In scope for the first release (production baseline)

- Owner / Business / Branch management with industry presets
- Roles: Owner, Admin, Branch Manager, Cashier, Inventory Manager, Accountant, HR Manager, Marketing, Employee
- POS: sales, discounts, returns, tills/shifts, receipts (web + offline desktop), **khata**, **loyalty points**
- Inventory: catalog, branch stock, transfers, purchase orders, goods receipts
- Accounting: chart of accounts, journals (auto + manual), GL, trial balance, P&L, balance sheet, AR/AP
- Pakistan sales tax defaults + FBR Tier-1 **hooks** (async/mock; production adapter later)
- HR: employees, attendance (POS/mobile), leave, payroll into the ledger, ESS
- Owner dashboards, RBAC-filtered navigation, and reports
- Platform subscription plan limits + LemonSqueezy webhook/checkout
- CRM campaigns as-built (email/in-app; audiences all/khata/min_points)
- Push + in-app + email notifications; English + Urdu
- **Customer Portal** — customer login (separate from staff), orders, loyalty, khata/AR

## Roadmap (Should — not Must-complete)

Helpdesk · Public API/webhooks · BI · appointments · production FBR adapter · full billing portal

## Not in the first release

Customer-facing e-commerce storefront, full manufacturing/MRP, biometric clocks, multi-currency group consolidation, non-Pakistan payroll e-filing automation, fixed-asset management.

## Actors (SRS §2.3)

Business Owner · Admin · Branch Manager · Cashier · Inventory Manager · Accountant · HR Manager · Marketing · Employee · Platform Admin  
(Roadmap: Support Agent · Customer Portal · Service Staff)

## Repository layout

```
POS/
├── kaarobar-web/       # Next.js — marketing + authenticated dashboard / browser POS
├── kaarobar-mobile/    # Expo RN — owner/manager app + staff clock-in / leave / payslips
├── kaarobar-desktop/   # Electron — offline-capable branch POS terminal
├── kaarobar-BE/        # Elixir/Phoenix API + PostgreSQL (modular monolith)
├── docs/               # ADRs and architecture notes
└── docker-compose.yml  # Postgres + Redis for local development
```

Clients are independently deployable (no shared npm packages). Theme tokens are duplicated per app so branding stays consistent without coupling releases.

## Architecture (SRS §3 — adapted)

| SRS original | This implementation |
|--------------|---------------------|
| NestJS modular monolith | **Elixir / Phoenix** modular monolith (contexts = SRS modules) |
| MongoDB Atlas | **PostgreSQL** shared database, app-enforced tenant isolation |
| BullMQ + Redis | **Oban** (Postgres-backed job queue) |
| React web | **Next.js** web |
| Electron POS + SQLite outbox | **Electron** + SQLite sync (offline) |
| React Native | **Expo / React Native** |

```
Clients (Web / Mobile / Desktop)
        │  HTTPS REST /api/v1  (+ WebSocket later)
        ▼
Phoenix API — Auth/RBAC · Tenancy · POS · Inventory · Accounting · HR · Reporting · Billing · FBR · Notifications
        │
        ▼
PostgreSQL (owner_id / business_id / branch_id) · Oban · Cloudflare R2 (later)
```

### Multi-tenancy (SRS §3.2.2 / SEC-NFR-001)

Shared cluster, tenant-isolated by ID. Every tenant-scoped table carries `owner_id` and usually `business_id` / `branch_id`, with compound indexes. Enforced in Ecto + Plug; CI cross-tenant tests required.

### Offline POS (SRS §10)

Desktop POS keeps a local catalog and stock, queues sales with a `client_txn_id`, and syncs without creating duplicates. Stock updates apply as deltas (never absolute overwrites).

## Backend modules (SRS §3.3 / §5)

| Context | SRS modules |
|---------|-------------|
| Accounts / Tenancy | TEN — identity, RBAC, businesses, branches, audit |
| Pos | POS — sales, returns, tills |
| Inventory | INV — products, stock, PO, GRN, transfers |
| Accounting | ACC — COA, journals, statements, tax |
| Hr | HR — employees, attendance, leave, payroll |
| Reporting | RPT — owner/branch dashboards |
| Billing | ADM — LemonSqueezy subscription limits |
| Integrations.Fbr | FBR — Tier-1 async reporting |
| Notifications | NOT — email (SMS/WhatsApp later) |

## Technology stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16, React 19, Tailwind CSS 4 |
| Mobile | Expo / React Native |
| Desktop | Electron |
| API | Elixir, Phoenix, Ecto, Guardian, Oban, Argon2 |
| Database | PostgreSQL 16 |
| Object storage | Cloudflare R2 (planned) |
| Subscription billing | LemonSqueezy (planned) |

## Theme (all clients)

| Token | Value |
|-------|-------|
| Brand | `#1d4ed8` Deep Sapphire |
| Accent | `#0f766e` Teal |
| Logo tile | `#2d6df6` (modular K icon SVG) |
| Background | `#f4f7fb` |
| Heading | `#0f172a` |
| Sidebar | `#0b1220` |

Brand assets: [`docs/brand/`](docs/brand/) · `KaarobarLogo` in web/desktop · Expo/Electron use `assets/icon.png`.

## Quick start

```bash
# Infrastructure (optional if Postgres already runs locally)
docker compose up -d

# Backend — http://localhost:4000/api/v1
cd kaarobar-BE && mix deps.get && mix ecto.setup && mix phx.server

# Web — http://localhost:3000 (landing when logged out, /app when logged in)
cd kaarobar-web && npm install && npm run dev

# Mobile
cd kaarobar-mobile && npm install && npm start

# Desktop POS
cd kaarobar-desktop && npm install && npm start
```

Demo seed user: `owner@kaarobar.local` / `Password@123`  
Additional owners: `owner2@` (growth), `owner3@` (starter), `owner4@` (trial) — same password.  
Staff: `manager@` / `cashier@` / `accountant@` / `hr@` / `inventory@kaarobar.local` (and `*2@`, `*3@`, `*4@` per owner).  
Fresh demo data: `cd kaarobar-BE && mix ecto.reset`

### Customer Portal

Customers sign in separately from staff (no staff roles). Portal UI lives in the web app.

| | |
|--|--|
| URL | [http://localhost:3000/portal/login](http://localhost:3000/portal/login) |
| Register | [http://localhost:3000/portal/register](http://localhost:3000/portal/register) (when the business has self-register enabled) |
| Reset | [http://localhost:3000/portal/reset](http://localhost:3000/portal/reset) |

Login needs **Business ID** (UUID) + customer **email** + **password**.

After seeding (`mix ecto.setup` / `mix ecto.reset`), the console prints portal logins for the primary owner’s enriched businesses. Typical demo credentials:

```
Email:    ayesha.customer@kaarobar-demo.pk
          admin@neighborhoodclinic.pk
          procurement@hotelsupplies.pk
          raza.traders@kaarobar-demo.pk
Password: Password@123
Business ID: printed in the seed summary (owner@kaarobar.local businesses)
```

Staff can also enable portal login when creating/editing a customer (**Customer portal login** + **Portal password**), or invite via `POST /api/v1/customers/:id/portal-invite`.

More detail: [docs/crm.md](docs/crm.md).

Module docs: [Tenancy](docs/tenancy.md) · [POS](docs/pos.md) · [Returns / tills / procurement](docs/returns-tills-procurement.md) · [Accounting](docs/accounting.md) · [HR & payroll](docs/hr-payroll.md) · [Platform / reporting / integrations](docs/platform.md) · [CRM & Customer Portal](docs/crm.md) — web, mobile, and desktop share `/api/v1`; accounting on web + API; HR includes web + mobile ESS; platform covers reports, billing, FBR, notifications, and offline sync.

## Non-functional highlights (SRS §9)

- POS checkout &lt; 2s p95 online (PERF-NFR-001)
- Tenant scoping on every data access + CI (SEC-NFR-001)
- Posted journals immutable; corrections via reversing entries (ACC-FR-010)
- English + Urdu UI (`en` / `ur`, RTL for Urdu) on web, mobile, and desktop — profile language preference via `PATCH /api/v1/auth/me`
- Desktop POS usable offline ≥ 24h with cached data (REL-NFR-002 / OFF-FR)

## Documentation

- [AGENTS.md](AGENTS.md) — Cursor/agent instructions (SRS authority + ISO engineering rules)
- [Brand assets](docs/brand/) — Kaarobar modular-K SVG / PNG
- [KRB-SRS-003 — Software Requirements Specification v3.1 Production Baseline](docs/srs/KRB-SRS-003.md) ([v2.0 archive](docs/srs/KRB-SRS-002.md))
- [ADR 001 — PostgreSQL multi-tenancy](docs/adr/001-postgres-multi-tenancy.md)
- [Architecture & module map](docs/architecture.md)
- [Requirement ID index](docs/requirements-index.md)
- [Tenancy](docs/tenancy.md) · [POS](docs/pos.md) · [Returns / tills / procurement](docs/returns-tills-procurement.md) · [Accounting](docs/accounting.md) · [HR & payroll](docs/hr-payroll.md) · [Platform](docs/platform.md) · [CRM & Customer Portal](docs/crm.md)

## Compliance note

FBR Tier-1 behaviour in this repo is an engineering implementation against publicly described rules. Treat regulatory detail as subject to tax-advisor review before production (SRS §1.4.5, Appendix C).
