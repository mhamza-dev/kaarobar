# AGENTS.md — Kaarobar

Instructions for Cursor (and any coding agent) working in this repository.

## 1. Authority (read first)

| Document | Role |
|----------|------|
| [`docs/srs/KRB-SRS-004.md`](docs/srs/KRB-SRS-004.md) | **Authoritative SRS v4.1** — whole product family (Cloud + Offline Desktop); multi-market |
| [`docs/requirements-index.md`](docs/requirements-index.md) | Stable requirement ID prefixes (incl. `FUT-FR` upcoming) |
| [`docs/architecture.md`](docs/architecture.md), [`docs/adr/`](docs/adr/) | How this repo implements the SRS |
| Module docs under [`docs/`](docs/) | Tenancy, POS, accounting, HR, platform, CRM status |
| [`docs/offline-desktop.md`](docs/offline-desktop.md) | Offline Desktop Edition feature doc (`ODE-FR`) |
| [`docs/architecture/client-cache-standards.md`](docs/architecture/client-cache-standards.md) | TanStack Query defaults for Cloud clients |

**v4.1 rule:** MoSCoW **Must** = production baseline (shipped). Two commercial editions: **Kaarobar Cloud** (subscription) and **Kaarobar Offline Desktop** (one-time). Launch markets include Pakistan, UK, Germany, France, and further markets as Product enables — FBR is the Pakistan fiscal pack, not product-wide geography. Portal / Helpdesk / Public API / coupons / appointments are **Should** until Product promotes them. §14 upcoming features (`FUT-FR-*`) are **Could** until promoted. When **code and SRS disagree**, stop and ask the human.

Requirement language follows **RFC 2119** (`shall` / `should` / `may`) and **MoSCoW** (Must / Should / Could). Cite IDs (e.g. `POS-FR-005`, `SEC-NFR-001`, `ODE-FR-001`) in PRs, commits when asked, and tests.

---

## 2. Product snapshot

**Kaarobar** is a product of **2ndHub Solutions**.

| Edition | Who | Platforms | Commercial |
|---------|-----|-----------|------------|
| **Kaarobar Cloud** | Multi-business / multi-branch | Web + Desktop (sync) + Mobile | Subscription (Safepay) |
| **Kaarobar Offline Desktop** | Single shop | Desktop only (local SQLite) | One-time license |

Cloud hierarchy: **Owner → Business → Branch**. Offline: one shop per install — see [`docs/offline-desktop.md`](docs/offline-desktop.md).

Pillars (Cloud):

1. Point of Sale (offline-capable desktop till that syncs)
2. Double-entry Accounting (not a cash log)
3. HR & Payroll (posts to the same ledger)
4. CRM & Marketing (Phase A)
5. Customer Portal (Phase A)
6. Helpdesk, Public API/Webhooks, BI (Phase B)

Goals: **G1–G7** (see SRS §1.4.2 / README). Multi-market (Pakistan, UK, Germany, France, …); Pakistan FBR Tier-1 as first fiscal pack; launch-market locales (en/ur/de/fr/es/pt-BR/ar).

**Phased delivery (SRS Document Control):**

| Phase | Ship |
|-------|------|
| **Production baseline (Must)** | TEN/POS/INV/ACC/HR/RPT, CRM campaigns as-built, khata, loyalty points, push, desktop offline, Pakistan FBR pack hooks, Safepay webhook/checkout (PK Cloud path) |
| **A remaining (Should)** | Customer Portal, coupons, loyalty tiers, consent, named segments |
| **B (Should)** | Helpdesk, Public API/webhooks, BI, production FBR adapter, appointments |

Prefer production-baseline / Phase A remaining work unless the user explicitly asks for Phase B.

---

## 3. This repository’s stack (overrides SRS NestJS wording)

The SRS describes **logical modules**. This repo implements them as:

| Layer | Technology |
|-------|------------|
| API | **Elixir / Phoenix** modular monolith (`kaarobar-BE`) |
| DB | **PostgreSQL 16** (shared DB; tenant by ID) |
| Jobs | **Oban** (Postgres-backed) |
| Web | **Next.js** (`kaarobar-web`) |
| Mobile (staff) | **React Native CLI** (`kaarobar-mobile`) |
| Mobile (customer) | **React Native CLI** (`kaarobar-customer`) |
| Desktop POS (Cloud) | **Electron** + SQLite outbox (`kaarobar-desktop`) — syncs to API (`OFF-FR`) |
| Desktop POS (Offline Edition) | **Electron** + local SQLite (`kaarobar-desktop-offline`) — one-time license (`ODE-FR`); no NestJS/Phoenix day-to-day dependency |

Do **not** introduce NestJS, MongoDB, or BullMQ. Map SRS modules to Phoenix contexts:

| Context area | SRS prefixes |
|--------------|--------------|
| Accounts / Tenancy | TEN |
| Pos | POS |
| Inventory | INV |
| Accounting | ACC |
| Hr | HR |
| Reporting | RPT |
| Billing / Admin | ADM |
| CRM (Phase A) | CRM |
| Customer Portal (Phase A) | CUS |
| Helpdesk (Phase B) | SUP |
| Public API (Phase B) | API |
| FBR / Notifications / Offline | FBR (Pakistan fiscal pack), NOT, OFF (Cloud Desktop sync) |
| Offline Desktop Edition | ODE (package `kaarobar-desktop-offline`; see [`docs/offline-desktop.md`](docs/offline-desktop.md)) |

Clients are independently deployable (no shared npm packages). Theme tokens are duplicated per app.

---

## 4. How to implement a feature

1. Locate requirement IDs in SRS §5 / [`docs/requirements-index.md`](docs/requirements-index.md).
2. Read the matching module doc under `docs/` and existing code in the relevant app.
3. Implement with **tenant scope on every data path** (`owner_id` / `business_id` / `branch_id`).
4. Enforce RBAC at the **API** (not UI-only). Customer portal uses **`customer_accounts`**, never staff roles (`TEN-FR-014`).
5. Add tests that cite requirement IDs — especially money, tenant isolation, and auth.
6. Update module docs / requirement index if behavior or IDs change.
7. Keep diffs focused: no drive-by refactors or unrelated file churn.

---

## 5. ISO / high-level software engineering rules

### ISO/IEC/IEEE 29148 — Requirements engineering

- Treat KRB-SRS-004 as the contract for behavior.
- Keep requirement IDs **stable**; do not renumber casually.
- Implement **Must** before Should/Could unless the user says otherwise.
- Do not expand Out-of-Scope items (e-commerce storefront, fixed assets, biometrics, multi-currency consolidation, etc.) without an explicit product decision.
- Trace work: name the IDs you satisfy in PR descriptions and test names.

### ISO/IEC 25010 — Product quality

Honor NFRs in SRS §9, including:

- **PERF-NFR-001** — POS checkout &lt; 2s p95 when online
- **SEC-NFR-001** — tenant isolation on every data access + CI cross-tenant tests
- **REL-NFR-002 / OFF-FR** — desktop POS usable offline ≥ 24h with cached data
- **USE** — role-scoped UI; vertical-aware screens; confirmation for destructive actions
- **ACC-FR-010** — posted journals immutable; corrections via reversing entries only

### ISO/IEC/IEEE 42010 — Architecture

- Preserve the **modular monolith** and context boundaries (`docs/architecture.md`).
- POS/Inventory/HR post into Accounting **asynchronously** (Oban) so checkout is not blocked by ledger latency.
- Record material architecture changes as ADRs under `docs/adr/`.
- Prefer configuration (`business_types`, feature flags) over forking code per vertical.

### Security & multi-tenancy (non-negotiable)

- Every tenant-scoped query/filter includes the correct owner/business/branch scope.
- Customer sessions: isolate by `customer_id` (SRS §3.2.4); never elevate to staff.
- Passwords: Argon2 (or project standard); never log plaintext.
- No raw payment card data (tokenized gateway only).
- API keys (Phase B): store **hashed** secrets; audit access; rate-limit; allow immediate revoke.
- Sensitive PII (CNIC, bank accounts): column-level protection as specified in SRS.

### Financial & inventory integrity

- Journal entries must balance (debits = credits); reject unbalanced posts.
- Stock changes are **atomic delta** updates, never absolute overwrites (online or offline sync).
- Offline sales use `client_txn_id` idempotency (`OFF-FR-003`).
- Soft-deactivate businesses/branches; do not hard-delete historical financial data.

### Quality bar

- Unit/integration tests for core money paths, tenant isolation, and authz.
- Migrations must include tenant-scoping columns and indexes where required (`PERF-NFR-003`).
- Match existing code style, naming, and patterns in the touched package.
- Do not commit secrets (`.env`, credentials). Do not update git config or force-push.

---

## 6. Hard don’ts

- Build NestJS/Mongo “because the SRS mentions NestJS” — this repo is Phoenix + PostgreSQL.
- Skip tenant or customer isolation “for a quick demo.”
- Mutate posted `journal_entries` / `journal_lines` in place.
- Ship e-commerce storefront, fixed-asset management, or biometric hardware in MVP.
- Paste the entire SRS into chat or duplicate it into new docs — **link** to KRB-SRS-004.
- Invent new business verticals as schema forks; use `business_types` configuration.

---

## 7. Quick pointers

```
POS/
├── AGENTS.md                      # this file
├── kaarobar-BE/                   # Phoenix API (Elixir)
├── kaarobar-web/                  # Next.js
├── kaarobar-mobile/               # React Native CLI — staff
├── kaarobar-customer/             # React Native CLI — consumers
├── kaarobar-desktop/              # Electron Cloud POS (sync)
├── kaarobar-desktop-offline/      # Electron Offline Desktop Edition
├── docs/srs/KRB-SRS-004.md        # authoritative requirements
└── docs/requirements-index.md
```

Demo seed (local): see README — `owner@kaarobar.local` / `Password@123`.

Brand: use `KaarobarLogo` / `docs/brand/` — do not invent a new letter-K placeholder.
