# Kaarobar Backend (`kaarobar-BE`)

Elixir/Phoenix modular monolith implementing Kaarobar SRS **KRB-SRS-001** application layer.

**Stack overrides vs SRS Table 3.1:** Phoenix (not NestJS), PostgreSQL (not MongoDB), Oban (not BullMQ), Guardian JWT + Argon2.

## Responsibilities (SRS §3 / §5)

| Context | SRS coverage |
|---------|----------------|
| `Kaarobar.Accounts` | TEN-FR auth, password hashing |
| `Kaarobar.Tenancy` | TEN-FR businesses/branches/memberships; seeds Pakistan COA on business create (ACC-FR-001) |
| `Kaarobar.Pos` | POS-FR sales, returns, tills; `client_txn_id` idempotency (OFF-FR-003) |
| `Kaarobar.Inventory` | INV-FR products, stock, PO, GRN, transfers, adjustments |
| `Kaarobar.Accounting` | ACC-FR journals, TB/P&L/BS, auto-post from sales/payroll, reversals |
| `Kaarobar.Hr` | HR-FR employees, attendance, leave, payroll approval → ledger |
| `Kaarobar.Reporting` | RPT-FR owner dashboard aggregates |
| `Kaarobar.Billing` | ADM-FR plan limits; LemonSqueezy webhook stub |
| `Kaarobar.Integrations.Fbr` | FBR-FR async Tier-1 reporting (non-blocking) |
| `Kaarobar.Notifications` | NOT-FR email queue via Oban |

## API

- Base path: `/api/v1` (versioned — MNT-NFR-002)
- Auth: `Authorization: Bearer <token>`
- Tenant headers: `x-business-id`, `x-branch-id` (optional on owner-level routes)

## Setup

```bash
# Postgres required (docker compose from repo root, or local)
cd kaarobar-BE
mix deps.get
mix ecto.setup          # create + migrate + seed
mix phx.server          # http://localhost:4000
```

Demo seed: `owner@kaarobar.local` / `password123`

## Tests

```bash
mix test
# Includes SEC-NFR-001 style tenancy isolation coverage
```

## Financial integrity (SRS ACC-FR-003 / ACC-FR-010)

- Journal lines must balance before post
- Posted entries are not edited/deleted; use reversing entries
- Sale/stock/journal mutations use DB transactions / atomic stock updates
