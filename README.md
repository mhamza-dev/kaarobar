# Kaarobar

**Document reference:** KRB-SRS-001 (ISO/IEC/IEEE 29148:2018)  
**Product:** Unified POS, Accounting & Workforce Management Platform for multi-business, multi-branch owners

Kaarobar is a greenfield multi-tenant SaaS for owners who run more than one business—and each business may have more than one physical branch. The owner → business → branch hierarchy is foundational, not a bolt-on.

## Product pillars (SRS §1.4.1)

1. **Point of Sale** — Fast, offline-tolerant sales, returns, and inventory at the branch
2. **Accounting** — Double-entry bookkeeping under the POS (not a cash log)
3. **HR & Payroll** — Attendance, leave, and payroll that posts into the ledger

## Goals (SRS §1.4.2)

| ID | Goal |
|----|------|
| G1 | Reduce owner hustle — consolidated view of sales, cash, stock, and staff |
| G2 | Real accounting — every sale, purchase, and payroll posts balanced journals |
| G3 | Branch autonomy with central oversight (including offline POS) |
| G4 | Pakistan regulatory readiness (FBR Tier-1 hooks + configurable tax engine) |
| G5 | Low operating cost at early scale (shared DB, modular monolith) |

## In scope — Release 1.0 / MVP (SRS §1.4.3)

- Owner / Business / Branch management (multi-business, multi-branch)
- RBAC: Owner, Branch Manager, Cashier, Inventory Manager, Accountant, HR Manager, Employee
- POS: sales, discounts, returns, tills/shifts, receipts (web + offline desktop)
- Inventory: catalog, branch stock, transfers, PO, GRN
- Accounting: COA, journals (auto + manual), GL, TB, P&L, Balance Sheet, AR/AP
- Pakistan sales tax template + FBR Tier-1 integration hooks
- HR: employees, attendance (POS/mobile), leave, payroll → ledger
- Owner consolidated dashboards and reports
- Platform subscription billing (LemonSqueezy) for the owner’s Kaarobar plan

## Out of scope — Release 1.0 (SRS §1.4.4)

E-commerce storefront, full manufacturing/BOM, biometric attendance hardware, multi-currency consolidation, non-Pakistan payroll e-filing automation, loyalty/CRM marketing automation.

## Actors (SRS §2.2)

Business Owner · Branch Manager · Cashier · Inventory Manager · Accountant · HR Manager · Employee · Platform Admin

## Repository layout

```
POS/
├── kaarobar-web/       # Next.js — marketing + authenticated dashboard / browser POS
├── kaarobar-mobile/    # Expo RN — owner/manager oversight + employee self-service
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

Desktop POS caches catalog/stock, queues transactions with `client_txn_id`, syncs idempotently; stock changes apply as deltas (never absolute overwrites).

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
