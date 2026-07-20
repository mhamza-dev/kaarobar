# Kaarobar

POS, accounting, and payroll for owners who run more than one business—and often more than one branch in each.

Internal planning reference: **KRB-SRS-001** (ISO/IEC/IEEE 29148:2018). Stack choices in this repo differ from the original draft where noted (PostgreSQL + Elixir/Phoenix instead of MongoDB + NestJS).

Kaarobar is multi-tenant SaaS. Owner → business → branch isn’t an afterthought—it’s how the product is structured.

## What it covers

1. **Point of Sale** — Fast sales, returns, and stock at the branch, including offline desktop tills
2. **Accounting** — Real double-entry books under the POS (not a cash notebook)
3. **HR & Payroll** — Attendance, leave, and payroll that posts into the same ledger

## Goals

| ID | Goal |
|----|------|
| G1 | Less hustle for the owner — one view of sales, cash, stock, and staff |
| G2 | Real accounting — sales, purchases, and payroll post balanced journals |
| G3 | Branches that can work alone, with the owner still in control (including offline POS) |
| G4 | Pakistan-ready (FBR Tier-1 + configurable tax) |
| G5 | Keep early operating cost low (shared DB, modular monolith) |

## In scope for the first release

- Owner / Business / Branch management
- Roles: Owner, Branch Manager, Cashier, Inventory Manager, Accountant, HR Manager, Employee
- POS: sales, discounts, returns, tills/shifts, receipts (web + offline desktop)
- Inventory: catalog, branch stock, transfers, purchase orders, goods receipts
- Accounting: chart of accounts, journals (auto + manual), GL, trial balance, P&L, balance sheet, AR/AP
- Pakistan sales tax defaults + FBR Tier-1 reporting
- HR: employees, attendance (POS/mobile), leave, payroll into the ledger
- Owner dashboards and reports
- Platform subscription billing (LemonSqueezy)

## Not in the first release

Customer-facing online shop, full manufacturing/BOM, biometric clocks, multi-currency group consolidation, non-Pakistan payroll e-filing automation, loyalty/CRM marketing tools.

## Actors (SRS §2.2)

Business Owner · Branch Manager · Cashier · Inventory Manager · Accountant · HR Manager · Employee · Platform Admin

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
| Electron POS + SQLite outbox | **Electron** + SQLite sync (Phase offline) |
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
| Background | `#f4f7fb` |
| Heading | `#0f172a` |
| Sidebar | `#0b1220` |

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

Demo seed user: `owner@kaarobar.local` / `password123`

## Non-functional highlights (SRS §9)

- POS checkout &lt; 2s p95 online (PERF-NFR-001)
- Tenant scoping on every data access + CI (SEC-NFR-001)
- Posted journals immutable; corrections via reversing entries (ACC-FR-010)
- English + Urdu planned (USE-NFR-002)
- Desktop POS usable offline ≥ 24h with cached data (REL-NFR-002 / OFF-FR)

## Documentation

- [ADR 001 — PostgreSQL multi-tenancy](docs/adr/001-postgres-multi-tenancy.md)
- [Architecture & module map](docs/architecture.md)
- [Requirement ID index](docs/requirements-index.md)

## Compliance note

FBR Tier-1 behaviour in this repo is an engineering implementation against publicly described rules. Treat regulatory detail as subject to tax-advisor review before production (SRS §1.4.5, Appendix C).
