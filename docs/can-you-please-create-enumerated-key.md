# Kaarobar Cloud POS Backend — Implementation Plan

## Context

`backend/` is currently a bare Phoenix 1.8 skeleton (namespace `Kaarobar`, OTP app `:backend`, Postgres + Bandit, empty `/api` scope, no auth, no schemas). Every other cloud surface in the monorepo — [desktop/cloud](desktop/cloud), [web/main](web/main), [mobile/staff](mobile/staff), and later [mobile/customer](mobile/customer) — is an empty scaffold waiting on this API.

The product already exists in mature form as an **offline, single-shop** app: [desktop/local](desktop/local) ships a 25-table SQLite schema ([schema.ts](desktop/local/electron/db/schema.ts)), 4,565 lines of transactional domain logic ([service.ts](desktop/local/electron/domain/service.ts)), a role matrix ([permissions.ts](desktop/local/shared/auth/permissions.ts)), vertical gating ([businessNature.ts](desktop/local/shared/businessNature.ts)) and plan entitlements ([features.ts](desktop/local/shared/licensing/features.ts)). That app is sold separately as a one-time-licence product and **is explicitly out of scope** — no sync engine, no shared database. It is our *domain reference*, not our client.

**What we are building:** a multi-tenant, subscription-based cloud POS platform where one owner runs one or many businesses, each with many branches and many employees whose roles are scoped per business and per branch. It must serve every kind of business — retail, clothes, grocery, restaurant/café, salon/spa, laundry & ironing, repair workshops, pesticides/agri, pharmacy, rentals, gyms, professional services — from one schema, and be built to enterprise standards: strict tenant isolation, permission-checked everywhere, audited, idempotent, observable, and documented.

**Locked decisions**
| Decision | Choice |
|---|---|
| Clients | `desktop/cloud`, `web/main`, `mobile/staff` (+ `mobile/customer` later). **Excludes** `desktop/local`, `web/landing` |
| Offline sync | None. Online-only cloud API |
| Auth | DB-backed hashed bearer tokens, Phoenix 1.8 `Scope` pattern, no JWT deps |
| Delivery | Phased; every phase compiles, tests green, runnable |
| Tax & payments | Configurable tax engine **+** fiscal e-invoicing adapters **+** live gateways (Stripe / JazzCash / Easypaisa) |
| Customer API | Deferred — schema designed so it drops in with no migrations |
| Entitlements | Phoenix owns cloud subscriptions + Stripe Billing. Supabase keeps `desktop/local` licence keys, untouched |

---

## Blocker to clear first

**Elixir and Erlang are not installed on this machine** (`elixir`, `mix`, `erl`, `psql` all absent; Docker 29.4 is present). Everything runs through Docker.

Also: [.tool-versions](.tool-versions) pins `elixir 1.20.4-otp-28` against `erlang 29.0.5` (OTP 29) — an OTP mismatch. Phase 0 resolves this by pinning one consistent pair in the Docker image and correcting `.tool-versions`.

---

## Architecture

**Tenancy chain:** `organizations` (owner's account / billing tenant) → `businesses` (each with its own vertical + currency + branding) → `branches` (shops, kitchens, warehouses) → all operational data.

**Isolation — two layers, both required:**
1. `Kaarobar.Scope` — a struct carrying `current_user`, `organization`, `business`, `branch`, a resolved `MapSet` of permissions and the entitlement set. Built once per request by a plug. Every context function takes `%Scope{}` as its **first argument** (the Phoenix 1.8 convention) and no tenant-table query is written without it.
2. Postgres **row-level security** as defence-in-depth: each request transaction issues `SET LOCAL app.current_org_id`, and RLS policies on every tenant table make a scope-less query return zero rows rather than another tenant's data.

**Money:** `Decimal` on `numeric(16,4)` columns everywhere. No floats — a departure from the desktop app's `REAL` columns, which is deliberate.

**Inventory truth:** an append-only `stock_moves` ledger is authoritative; `stock_items.on_hand` is a projection maintained inside the same transaction under `SELECT … FOR UPDATE`. This makes concurrent checkouts across branches correct and every stock number explainable.

**Verticals:** a `business_type` maps to a set of enabled modules and allowed product kinds through `Kaarobar.Verticals` — a data-driven registry generalising [businessNature.ts](desktop/local/shared/businessNature.ts) from 4 natures to the full catalogue. Policies and controllers gate on `Verticals.module_enabled?/2`, so adding a vertical is a config change, not a migration.

**Every write endpoint** accepts an `Idempotency-Key` header; keys are persisted with their response so a retry from a flaky shop connection can never double-charge or double-decrement stock.

---

## Phase 0 — Toolchain, dependencies, API foundations

**Gate:** `docker compose up` boots Postgres + the app; `GET /api/v1/health` returns 200; `mix precommit` is green inside the container.

- `backend/docker-compose.yml` (Postgres 17 + app), `backend/Dockerfile` (multi-stage `mix release`), `backend/.dockerignore`, `.env.example`. All mix commands run as `docker compose run --rm app mix …`.
- **Strip dead asset pipeline** — there is no `backend/assets/` directory, so `mix assets.build` is broken today. Remove `esbuild`, `tailwind`, `heroicons`, `daisyui` deps, the `assets.*` aliases in [mix.exs](backend/mix.exs), and the esbuild/tailwind config blocks in [config/config.exs](backend/config/config.exs) and the `watchers` in [config/dev.exs](backend/config/dev.exs). Keep LiveDashboard.
- **Add deps:** `argon2_elixir`, `oban`, `open_api_spex`, `cloak_ecto`, `corsica`, `hammer`, `stripity_stripe`, `nimble_csv`, `ex_machina` + `faker` (test), `credo`, `dialyxir`, `sobelow`. Extend the `precommit` alias with `credo --strict` and `sobelow --exit`.
- **Foundations** in `lib/backend/` and `lib/backend_web/`:
  - `Kaarobar.Scope` — the request scope struct + resolution helpers.
  - `KaarobarWeb.Plugs.{RequestContext, RequireAuth, LoadScope, Authorize, Idempotency, RateLimit}`.
  - `KaarobarWeb.FallbackController` + `KaarobarWeb.ErrorJSON` — one error envelope: `{"error": {"code", "message", "details"}}`, with changeset errors rendered as field-keyed `details`.
  - `KaarobarWeb.Pagination` — cursor pagination (`limit`/`cursor`), returned as `{"data": [...], "meta": {"next_cursor"}}`.
  - `Kaarobar.Repo.Scoped` — a macro that refuses to build a tenant query without a `%Scope{}`.
  - Health/readiness endpoints, JSON structured logging with `request_id` + `org_id`, telemetry, CORS allowlist.
- Router restructured into `/api/v1` with `:api_public` and `:api_authenticated` pipelines.

---

## Phase 1 — Identity, tenancy, RBAC, audit

**Gate:** an owner registers, creates an org → business → branch, invites a manager scoped to one branch, and that manager is provably denied every out-of-scope action. Policy matrix tests cover all system roles.

**Migrations / schemas** (`priv/repo/migrations/`, `lib/backend/{accounts,tenancy,access_control,audit}/`)

- `organizations` — owner, name, slug, country, timezone, default currency, status, `settings` jsonb
- `users` — global identity: citext email (unique), Argon2 hash, name, phone, avatar, locale, timezone, `confirmed_at`, TOTP secret (Cloak-encrypted), status
- `user_tokens` — hashed token + `context` (`session` / `api` / `reset` / `confirm` / `invite`), device label, IP, user-agent, `last_used_at`, `expires_at`. Enables per-device revoke and sign-out-everywhere
- `businesses` — org, name, `business_type`, currency, timezone, branding jsonb (brand colour, logo, socials, receipt header/footer), status
- `branches` — business, name, code, address, phone, geo, timezone, `is_main`, opening hours jsonb, status
- `memberships` — user × org × business (null business = org-wide), employment metadata, status
- `membership_branches` — branch scoping for a membership
- `roles` / `permissions` / `role_permissions` / `membership_roles` / `permission_grants` (per-membership `allow`/`deny` overrides)
- `invitations`, `audit_logs` (append-only: actor, action, entity, before/after jsonb, IP, request_id)

**Permission catalogue** — expand the 17 actions in [permissions.ts](desktop/local/shared/auth/permissions.ts) into ~140 `resource:action` keys grouped by module, seeded in `priv/repo/seeds/permissions.exs`. System role templates: `owner`, `admin`, `manager`, `supervisor`, `cashier`, `stock_keeper`, `accountant`, `waiter`, `kitchen`, `rider`, `stylist`, `technician`, `viewer` — plus fully custom per-org roles.

**Resolution order:** deny grant → allow grant → role permissions → business/branch scope check → entitlement check. Resolved once per request into the `Scope`.

**Endpoints:** `/auth/{register,login,logout,refresh,forgot,reset,confirm,mfa}`, `/me`, `/organizations`, `/businesses`, `/branches`, `/memberships`, `/roles`, `/permissions`, `/invitations`, `/audit-logs`.

---

## Phase 2 — Universal catalog, pricing, tax

**Gate:** one schema simultaneously models a clothing SKU matrix (size × colour), a salon service with duration, a restaurant dish with modifiers and a recipe, and a pesticide sold by weight with batch + expiry.

`lib/backend/{catalog,pricing,taxes,verticals}/`

- `Kaarobar.Verticals` — registry mapping ~18 business types → enabled modules, allowed product kinds, required sale fields (e.g. food requires service mode; salon requires "served by"). Generalises [businessNature.ts](desktop/local/shared/businessNature.ts)
- `categories` (materialised path, nested), `brands`, `units` + `unit_conversions` (pcs/kg/g/L/ml/m/box/dozen)
- `products` — kind (`item` / `service` / `bundle` / `deal` / `rental` / `membership` / `gift_card` / `fee`), `tracks_stock`, `tracks_batch`, `tracks_serial`, `is_weighted`, service duration, kitchen station, regulatory fields (hazard class, licence no.) , `attributes` jsonb
- `option_types` + `option_values` + `product_variants` — every product gets ≥1 variant; **variants are what stock and sale lines reference**
- `product_barcodes` — many per variant, including weighted-EAN price-embedded codes
- `bundle_components`, `recipes` + `recipe_components` (BOM: a burger consumes bun + patty; a hair colour consumes dye)
- `modifier_groups` + `modifiers` + `product_modifier_groups`
- `price_lists` + `price_list_items` (per branch / customer group / channel, effective-dated)
- `price_rules` — generalises `happy_hour_price_rules`: time windows, weekday mask, BOGO, tiered quantity, coupon codes, priority and stacking policy
- `taxes`, `tax_groups`, `tax_group_rates`, `tax_jurisdictions`; inclusive/exclusive pricing per business
- `Kaarobar.Pricing.resolve/2` — single price resolution entry point (base → price list → rules → modifiers → discounts), returning a fully itemised breakdown

---

## Phase 3 — Inventory & purchasing

**Gate:** receive a PO into a batch, transfer stock between branches, run a cycle count with variance approval, and produce a valuation report that reconciles exactly against the move ledger.

`lib/backend/{inventory,purchasing}/`

- `stock_items` (variant × branch, unique) — on_hand, reserved, incoming, reorder point/qty, bin
- `stock_moves` — immutable signed ledger; types: sale, return, purchase, purchase_return, adjustment, transfer_out/in, wastage, production_in/out, count
- `batches` (lot, mfg/expiry date) — mandatory for pesticides, pharmacy, food; `serial_numbers` for electronics/hardware
- `cost_layers` + `Kaarobar.Inventory.Costing` — FIFO and weighted-average, both supported per business
- `stock_transfers` (+ items, in-transit, discrepancy handling), `stock_counts` (+ items, variance approval), `stock_adjustments` + reason codes
- `suppliers`, `supplier_products`, `purchase_orders` + items, `goods_receipts` (GRN) + items, `supplier_bills`, `supplier_payments`, `purchase_returns`, `supplier_ledger_entries`
- `reorder_rules`; Oban jobs for low-stock and near-expiry alerts

---

## Phase 4 — POS core & sales

**Gate:** a full checkout — multi-tender split payment, line + order discounts, tax, stock decrement, customer ledger and a gapless invoice number — commits in one transaction; refunds, voids and shift close all balance. A concurrency test proves two cashiers cannot both sell the last unit.

`lib/backend/{sales,registers}/`

- `registers` (POS terminals per branch), `shifts` (opening float, expected vs declared cash per tender, variance), `cash_movements` (pay-in / pay-out / drop)
- `orders` + `order_items` — one unified ticket model serving restaurant tickets, salon visits and service jobs (status, channel, service mode, table, seat, course, kitchen status, `billed_qty` for partial billing)
- `sales` + `sale_items` + `sale_item_taxes` + `sale_item_modifiers` — with a **cost snapshot per line** so margin reporting never depends on today's cost
- `document_sequences` — gapless numbering per business/branch/document type/period, under advisory lock
- `payments` (cash / card / wallet / bank / credit / gift card / loyalty), `payment_refunds`, `returns` + `credit_notes`, `refund_requests` with the approval workflow carried over from the desktop model
- **`Kaarobar.Sales.Checkout`** — the transactional core, and the most important module in the codebase: validate → price → tax → lock and decrement stock → persist sale → tenders → ledger → audit → PubSub broadcast. Idempotency-key protected and fully unit-tested.

---

## Phase 5 — Customers, credit & loyalty

**Gate:** a credit sale moves the customer balance, a part-payment allocates across invoices correctly, and an aging report ties out.

`lib/backend/{customers,credit,loyalty}/` — `customers`, `customer_groups`, `customer_addresses`, `customer_contacts`, `customer_ledger_entries`, `credit_limits`, `customer_payments` + `payment_allocations`, aging buckets, `loyalty_programs` / `loyalty_accounts` / `loyalty_transactions`, `store_credits`, `gift_cards` + transactions, `customer_notes` + `follow_ups`.

---

## Phase 6 — Vertical modules

**Gate:** each vertical's flagship flow works end-to-end against its own seeded demo business.

`lib/backend/verticals/`

- **Food / restaurant / café** — `floors`, `dining_tables`, table sessions, `kitchen_stations` + `kitchen_tickets` (KOT/KDS), course firing, split bill (by seat / item / amount / share), merge & transfer tables, `deliveries` + rider assignment and status, happy-hour pricing (rides on `price_rules`)
- **Salon / spa** — `resources` (chair, room, staff), `appointments` + `appointment_services`, availability engine, walk-in queue, tips, `commission_rules` + `commissions` (per staff / service / product, tiered)
- **Laundry, ironing, repair, workshop** — `service_jobs` (intake → in progress → ready → delivered), `job_items` per garment/device with tag barcode, condition photos, rack location, ready-by date, pickup & delivery scheduling, customer notification hooks
- **Fashion / clothes** — size × colour matrix endpoints, size-run purchasing, season/style attributes
- **Agri-pesticides & pharmacy** — enforced batch + expiry, near-expiry alerting, regulated-substance register, licence numbers stamped on invoices, pack-size/dosage units
- **Rental** — `rental_agreements`, periods, deposits, late fees, availability calendar
- **Professional services** — quotes → jobs → invoices, time entries, retainers

---

## Phase 7 — Payments, fiscal compliance, subscription billing

**Gate:** a card sale captures through Stripe with a webhook-confirmed status; a JazzCash/Easypaisa sandbox payment reconciles; an FBR-shaped fiscal submission queues, retries and stamps the invoice; an org's subscription controls which modules it can reach.

`lib/backend/{payments,fiscal,billing}/`

- `payment_providers` (per-business, Cloak-encrypted credentials), `payment_intents`, `gateway_transactions`, `webhook_events` (dedup + replay-safe), `settlements`, reconciliation job
- `Kaarobar.Payments.Gateway` behaviour → `Stripe`, `JazzCash`, `Easypaisa`, `Manual` adapters
- `Kaarobar.Fiscal.Adapter` behaviour → `FBR` (Pakistan POS invoice), `Generic` e-invoice; `fiscal_submissions` with queued retry
- **Platform billing (Kaarobar ← tenant), separate from in-store payments:** `subscription_plans`, `plan_features`, `subscriptions`, `subscription_items` (seats, branches), trials, `platform_invoices`, dunning, Stripe Billing webhooks. `Kaarobar.Billing.Entitlements` gates modules — the same plan → features → limits idea as [features.ts](desktop/local/shared/licensing/features.ts), but backend-owned and unrelated to Supabase

---

## Phase 8 — Reporting, analytics & documents

**Gate:** dashboards for a business with 100k sales respond in well under a second; an X/Z report matches the shift; P&L reconciles against the ledgers.

- `Kaarobar.Reports.*` — sales by day/hour/branch/cashier/product/category/tender, X & Z reports, inventory valuation & movement, receivables & payables aging, profit and margin from cost snapshots, staff performance & commissions, tax reports, expiry & low stock, customer RFM, and **org-level consolidated reporting across all of an owner's businesses**
- `daily_sales_rollups` / `product_daily_rollups` refreshed by Oban cron, so dashboards never scan raw sales
- `expenses` + categories, `bank_accounts`, cash book — enough accounting for a real P&L
- Document rendering: receipt / invoice / PO / customer-ledger HTML **and ESC/POS payload** endpoints so cloud clients print what the desktop app prints; `receipt_templates` per business; all 7 languages with RTL, reusing the label sets in [receiptTemplates.ts](desktop/local/electron/receipt/receiptTemplates.ts) and [currencies.ts](desktop/local/shared/currencies.ts) / [languages.ts](desktop/local/shared/languages.ts)
- CSV/XLSX export jobs with presigned download links

---

## Phase 9 — Realtime, hardening, documentation

**Gate:** `mix precommit` green including Credo strict and Sobelow; OpenAPI spec served and complete; RLS verified by a test that a scope-less query returns nothing.

- **Phoenix Channels:** `business:{id}` (live sales feed), `kds:{branch_id}` (kitchen display), `register:{id}`, `stock:{branch_id}`; Presence for staff online status
- **Oban queues:** default, mailers, webhooks, reports, payments, notifications, maintenance; cron for rollups, expiry alerts, dunning, token cleanup
- **Notifications:** Swoosh email, SMS/WhatsApp adapter behaviour, Expo push for `mobile/staff`
- **Security:** Argon2, TOTP MFA, cashier PIN login at a register, token rotation, Cloak field encryption for credentials and PII, Sobelow, per-endpoint rate limits, CORS allowlist, complete audit coverage
- **Postgres RLS** policies on every tenant table + `SET LOCAL app.current_org_id` in the request transaction
- **OpenAPI 3** via `open_api_spex`, served with Swagger UI at `/api/docs` — this is the contract `web/main` and `mobile/staff` will be built against
- Soft delete + archival, GDPR export/erasure, LiveDashboard behind admin auth, optional Sentry

---

## Testing

Written alongside each phase, never deferred:
- `test/support/factory.ex` (ExMachina) + `DataCase`/`ConnCase` extended with `scope_fixture` helpers
- Context tests for every public function; controller tests for every endpoint
- **Policy matrix tests** — every system role × every permission, asserting both allow and deny
- **Math tests** — pricing, tax inclusive/exclusive, FIFO vs weighted-average costing, ledger balances
- **Concurrency tests** — simultaneous checkout of the last unit; concurrent invoice numbering must stay gapless
- **Idempotency tests** — replayed checkout with the same key produces one sale
- Tenant-isolation tests — cross-org and cross-branch access denied at both the scope and RLS layers

---

## Verification

Everything runs through Docker, since Elixir is not installed locally.

```bash
cd backend
docker compose up -d db
docker compose run --rm app mix deps.get
docker compose run --rm app mix ecto.setup      # create, migrate, seed
docker compose run --rm app mix test
docker compose run --rm app mix precommit       # compile --warnings-as-errors, format, credo, sobelow, test
docker compose up app                           # serves on localhost:4000
```

- `priv/repo/seeds.exs` provisions a demo org with **one business per vertical** (retail, clothes, restaurant, salon, ironing/laundry, pesticides), each with branches, staff across all roles, catalog, stock and sample sales — so every phase gate can be exercised immediately.
- `backend/scripts/smoke.http` (and a curl equivalent) walks the critical path: register → create business + branch → invite staff → create product with variants → receive a PO → open a shift → checkout with split tender → refund → close shift → pull reports.
- `GET /api/docs` renders the OpenAPI spec — the handoff artifact for the frontend apps.
- No frontend client exists yet, so all verification is HTTP + test suite. That is deliberate: the API contract is the deliverable.

---

## Sequencing note

Phases 0–4 are the critical path to a working POS. Phases 5–9 deepen it. I will stop at each gate with a working, tested, runnable backend so you can review and redirect before the next phase begins.
