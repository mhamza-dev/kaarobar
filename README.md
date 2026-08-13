# Kaarobar

POS, accounting, and payroll. A product of **2ndHub Solutions**.

Internal planning reference: **[KRB-SRS-004](docs/srs/KRB-SRS-004.md)** v4.1 Whole Product Family — Multi-Market (ISO/IEC/IEEE 29148:2018; supersedes retired KRB-SRS-003/002 and v4.0). Stack: Elixir/Phoenix + PostgreSQL + Oban. Launch markets include Pakistan, UK, Germany, France, and further markets as Product enables.

Company marketing site (product landing, about, etc.) is a separate **2ndHub Solutions** repo. **kaarobar-web** opens on the login page (`/` → `/login`).

## Product editions

| Edition | Who | Platforms | Commercial |
|---------|-----|-----------|------------|
| **Kaarobar Cloud** | Multi-business / multi-branch owners | Web + Desktop (sync offline) + Mobile | Subscription (Safepay) |
| **Kaarobar Offline Desktop** | Single shop on their own PC | Desktop only, local SQLite after license | One-time purchase |

Offline Desktop feature list: [`docs/offline-desktop.md`](docs/offline-desktop.md) (`ODE-FR-*`). Cloud Desktop sync remains `OFF-FR-*` (queues then syncs; not the Offline SKU).

## What it covers

1. **Point of Sale** — Fast sales, returns, khata, loyalty points, offline desktop tills
2. **Accounting** — Real double-entry books under the POS (not a cash notebook)
3. **HR & Payroll** — Attendance, leave, payroll, ESS
4. **CRM (baseline)** — Email/in-app campaigns, audience filters, loyalty points
5. **Platform** — Plan limits, Safepay billing (PK path), Pakistan FBR fiscal pack hooks, push/email, launch-market locales
6. **Roadmap** — Helpdesk · Public API · BI · appointments · production FBR adapter · UK/DE/FR tax packs · full billing portal

## Goals

| ID | Goal |
|----|------|
| G1 | Less hustle for the owner — one view of sales, cash, stock, and staff |
| G2 | Real accounting — sales, purchases, and payroll post balanced journals |
| G3 | Branches that can work alone, with the owner still in control (including offline POS) |
| G4 | Jurisdiction-ready tax & fiscal integrations (configurable tax; Pakistan FBR pack first; UK/DE/FR roadmap) |
| G5 | Keep early operating cost low (shared DB, modular monolith) |
| G6 | Customer engagement & retention |
| G7 | Platform extensibility via API |

## In scope for the first release (production baseline)

- Owner / Business / Branch management with industry presets
- Roles: Owner, Admin, Branch Manager, Cashier, Inventory Manager, Accountant, HR Manager, Marketing, Employee
- POS: sales, discounts, returns, tills/shifts, receipts (web + offline desktop), **khata**, **loyalty points**
- Inventory: catalog, branch stock, transfers, purchase orders, goods receipts
- Accounting: chart of accounts, journals (auto + manual), GL, trial balance, P&L, balance sheet, AR/AP
- Configurable tax per jurisdiction + Pakistan FBR Tier-1 **fiscal pack hooks** (async/mock; production adapter later; not required for UK/DE/FR businesses)
- HR: employees, attendance (POS/mobile), leave, payroll into the ledger, ESS
- Owner dashboards, RBAC-filtered navigation, and reports
- Platform subscription plan limits + Safepay webhook/checkout (Pakistan Cloud path)
- CRM campaigns as-built (email/in-app; audiences all/khata/min_points)
- Push + in-app + email notifications; launch locales (en/ur/de/fr/es/pt-BR/ar)
- **Customer Portal** — customer login (separate from staff), orders, loyalty, khata/AR

## Roadmap (Should — not Must-complete)

Helpdesk · Public API/webhooks · BI · appointments · production FBR adapter · UK/DE/FR tax packs · full billing portal · other-market Cloud billing

## Not in the first release

Customer-facing e-commerce storefront, full manufacturing/MRP, biometric clocks, multi-currency group consolidation, automated statutory e-filing outside enabled jurisdiction packs, fixed-asset management.

## Actors (SRS §2.3)

Business Owner · Admin · Branch Manager · Cashier · Inventory Manager · Accountant · HR Manager · Marketing · Employee · Platform Admin  
(Roadmap: Support Agent · Customer Portal · Service Staff)

## Repository layout

```
kaarobar/
├── kaarobar-web/                 # Next.js — authenticated dashboard / browser POS / buyer market
├── kaarobar-mobile/              # Expo (React Native) — staff (POS, sales, products, customers, ESS)
├── mobile-consumer/              # Expo (React Native) — consumer marketplace
├── kaarobar-desktop/             # Electron — Cloud Desktop POS (SQLite outbox → sync)
├── kaarobar-desktop-offline/     # Electron — Offline Desktop Edition (local SQLite, one-time license)
├── kaarobar-backend/             # Elixir/Phoenix API + PostgreSQL (modular monolith)
├── shared/mobile/                # Source shared by the two Expo apps (@shared/*)
├── docs/                         # SRS, ADRs, module docs, architecture notes
└── docker-compose.yml            # Postgres + Redis for local development
```

Clients are independently deployable (no shared npm packages). The two mobile apps share source via `shared/mobile/` ([ADR 002](docs/adr/002-shared-mobile-source-folder.md)); web and desktop duplicate theme tokens so branding stays consistent without coupling releases.

| Desktop package | Edition | Data | Cloud API |
|-----------------|---------|------|-----------|
| `kaarobar-desktop` | Kaarobar Cloud | Local cache + outbox | Syncs to `kaarobar-backend` (`OFF-FR-*`) |
| `kaarobar-desktop-offline` | Kaarobar Offline Desktop | Local SQLite only | License activation only (`ODE-FR-*`) |

## Architecture (SRS §3 — adapted)

| SRS original | This implementation |
|--------------|---------------------|
| NestJS modular monolith | **Elixir / Phoenix** modular monolith (contexts = SRS modules) |
| MongoDB Atlas | **PostgreSQL** shared database, app-enforced tenant isolation |
| BullMQ + Redis | **Oban** (Postgres-backed job queue) |
| React web | **Next.js** web |
| Electron POS + SQLite outbox | **Electron** Cloud Desktop (`kaarobar-desktop`) + Offline Desktop SKU (`kaarobar-desktop-offline`) |
| React Native | **Expo SDK 57** (`kaarobar-mobile` staff + `mobile-consumer`) |

```
Cloud clients (Web / Mobile / Cloud Desktop)
        │  HTTPS REST /api/v1  (+ WebSocket later)
        ▼
Phoenix API — Auth/RBAC · Tenancy · POS · Inventory · Accounting · HR · Reporting · Billing · FBR · Notifications
        │
        ▼
PostgreSQL (owner_id / business_id / branch_id) · Oban · Cloudflare R2 (later)

Offline Desktop (kaarobar-desktop-offline) — local SQLite; no day-to-day API dependency after license
```

### Multi-tenancy (SRS §3.2.2 / SEC-NFR-001)

Shared cluster, tenant-isolated by ID. Every tenant-scoped table carries `owner_id` and usually `business_id` / `branch_id`, with compound indexes. Enforced in Ecto + Plug; CI cross-tenant tests required.

### Offline POS (SRS §10)

**Cloud Desktop (`OFF-FR`):** keeps a local catalog and stock, queues sales with a `client_txn_id`, and syncs without creating duplicates. Stock updates apply as deltas (never absolute overwrites).

**Offline Desktop Edition (`ODE-FR`):** single shop, local SQLite, license-then-offline — day-to-day selling does not require cloud. See [`docs/offline-desktop.md`](docs/offline-desktop.md).

## Backend modules (SRS §3.3 / §5)

| Context | SRS modules |
|---------|-------------|
| Accounts / Tenancy | TEN — identity, RBAC, businesses, branches, audit |
| Pos | POS — sales, returns, tills |
| Inventory | INV — products, stock, PO, GRN, transfers |
| Accounting | ACC — COA, journals, statements, tax |
| Hr | HR — employees, attendance, leave, payroll |
| Reporting | RPT — owner/branch dashboards |
| Billing | ADM — Safepay subscription limits (Pakistan) |
| Integrations.Fbr | FBR — Tier-1 async reporting |
| Notifications | NOT — email (SMS/WhatsApp later) |

## Technology stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16, React 19, Tailwind CSS 4 |
| Mobile (staff) | Expo SDK 57 / React Native 0.86 (`kaarobar-mobile`) |
| Mobile (customer) | Expo SDK 57 / React Native 0.86 (`mobile-consumer`) |
| Desktop (Cloud) | Electron (`kaarobar-desktop`) |
| Desktop (Offline Edition) | Electron + SQLite (`kaarobar-desktop-offline`) |
| API | Elixir, Phoenix, Ecto, Guardian, Oban, Argon2 |
| Database | PostgreSQL 16 |
| Object storage | Cloudflare R2 (planned) |
| Subscription billing | Safepay (JazzCash / Easypaisa / cards) |

## Theme (all clients)

| Token | Value |
|-------|-------|
| Brand | `#1d4ed8` Deep Sapphire |
| Accent | `#0f766e` Teal |
| Logo tile | `#2d6df6` (modular K icon SVG) |
| Background | `#f4f7fb` |
| Heading | `#0f172a` |
| Sidebar | `#0b1220` |

Brand assets: [`docs/brand/`](docs/brand/) · `KaarobarLogo` in web/desktop · RN/Electron use `assets/icon.png`.

## Quick start

```bash
# Infrastructure (optional if Postgres already runs locally)
docker compose up -d

# Backend — http://localhost:4000/api/v1
cd kaarobar-backend && mix deps.get && mix ecto.setup && mix phx.server

# Web — http://localhost:3000 (landing when logged out, /app when logged in)
cd kaarobar-web && npm install && npm run dev

# Staff mobile (Expo — press a/i, or scan the QR with Expo Go)
cd kaarobar-mobile && npm install && npm start

# Customer mobile (Expo)
cd mobile-consumer && npm install && npm start

# Cloud Desktop POS (syncs to API)
cd kaarobar-desktop && npm install && npm start

# Offline Desktop Edition (local SQLite; see package README for Node/env)
cd kaarobar-desktop-offline && npm install && npm run dev
```

Demo seed user: `owner@kaarobar.local` / `Password@123`  
Additional owners: `owner2@` (growth), `owner3@` (starter), `owner4@` (trial) — same password.  
Staff: `manager@` / `cashier@` / `accountant@` / `hr@` / `inventory@kaarobar.local` (and `*2@`, `*3@`, `*4@` per owner).  
Fresh demo data: `cd kaarobar-backend && mix ecto.reset` (runs migrations, seeds `subscription_plans`, demo businesses/branches, and CRM data). After schema changes that add tables such as `subscription_plans` or `campaign_payments`, use `mix ecto.reset` locally so seeds stay in sync.

### Billing (Safepay — Pakistan)

Optional env vars in `kaarobar-backend/.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `SAFEPAY_API_KEY` | Client key for one-time payment init |
| `SAFEPAY_SECRET_KEY` | Merchant secret (passport token / API) |
| `SAFEPAY_WEBHOOK_SECRET` | Verify `X-SFPY-SIGNATURE` on billing webhooks |
| `SAFEPAY_ENVIRONMENT` | `sandbox` (default) \| `production` \| `development` |
| `SAFEPAY_PLAN_STARTER` / `_GROWTH` / `_ENTERPRISE` | Safepay dashboard plan IDs for upgrades |
| `SAFEPAY_CHECKOUT_URL` | Static checkout URL fallback when API credentials are missing |

Without API credentials, subscription checkout falls back to `SAFEPAY_CHECKOUT_URL` and campaign sends use the `dev_fallback` confirm-payment path. See [`docs/platform.md`](docs/platform.md) and [`docs/crm.md`](docs/crm.md).

Lemon Squeezy env vars (`LEMONSQUEEZY_*`) are deprecated and unused on the live path.

### Buyer marketplace (unified login)

Staff and buyers share `/login`. Choose **Sign in as Consumer** (or open `/login?as=consumer`). No separate portal product; legacy `/portal/*` redirects.

| | |
|--|--|
| Sign in | [http://localhost:3000/login?as=consumer](http://localhost:3000/login?as=consumer) |
| Market | [http://localhost:3000/app](http://localhost:3000/app) (buyer discover; store at `/app/market/:id`) |
| API | `POST /api/v1/auth/login` with `actor: "consumer"` |

Login needs buyer **email** + **password** (platform-wide identity; no Business ID).

After seeding (`mix ecto.setup` / `mix ecto.reset`), typical demo credentials:

```
Email:    ayesha.customer@kaarobar-demo.pk
          admin@neighborhoodclinic.pk
          procurement@hotelsupplies.pk
          raza.traders@kaarobar-demo.pk
Password: Password@123
```

Staff can attach a customer to a buyer account (invite email → `/login?as=consumer&invite=…`), or provision via customers UI / `POST /api/v1/customers/:id/portal-invite`.

More detail: [docs/crm.md](docs/crm.md).

Module docs: [Tenancy](docs/tenancy.md) · [POS](docs/pos.md) · [Returns / tills / procurement](docs/returns-tills-procurement.md) · [Accounting](docs/accounting.md) · [HR & payroll](docs/hr-payroll.md) · [Platform / reporting / integrations](docs/platform.md) · [CRM & Customer Portal](docs/crm.md) · [Offline Desktop](docs/offline-desktop.md) · [Client cache standards](docs/architecture/client-cache-standards.md) — Cloud web/mobile/desktop share `/api/v1`; Offline Desktop is local-first (`ODE-FR`).

## Non-functional highlights (SRS §9)

- POS checkout &lt; 2s p95 online (PERF-NFR-001)
- Tenant scoping on every data access + CI (SEC-NFR-001)
- Posted journals immutable; corrections via reversing entries (ACC-FR-010)
- English + Urdu UI (`en` / `ur`, RTL for Urdu) on web, mobile, and desktop — profile language preference via `PATCH /api/v1/auth/me`
- Desktop POS usable offline ≥ 24h with cached data (REL-NFR-002 / OFF-FR)

## Documentation

- [AGENTS.md](AGENTS.md) — Cursor/agent instructions (SRS authority + ISO engineering rules)
- [Brand assets](docs/brand/) — Kaarobar modular-K SVG / PNG
- [KRB-SRS-004 — Software Requirements Specification v4.0 Whole Product Family](docs/srs/KRB-SRS-004.md)
- [ADR 001 — PostgreSQL multi-tenancy](docs/adr/001-postgres-multi-tenancy.md)
- [Architecture & module map](docs/architecture.md)
- [Client cache standards](docs/architecture/client-cache-standards.md)
- [Offline Desktop Edition](docs/offline-desktop.md) (`ODE-FR-*`; package: `kaarobar-desktop-offline`)
- [Requirement ID index](docs/requirements-index.md)
- [Tenancy](docs/tenancy.md) · [POS](docs/pos.md) · [Returns / tills / procurement](docs/returns-tills-procurement.md) · [Accounting](docs/accounting.md) · [HR & payroll](docs/hr-payroll.md) · [Platform](docs/platform.md) · [CRM & Customer Portal](docs/crm.md)

## Compliance note

FBR Tier-1 behaviour in this repo is an engineering implementation against publicly described rules. Treat regulatory detail as subject to tax-advisor review before production (SRS §1.4.5, Appendix C).
