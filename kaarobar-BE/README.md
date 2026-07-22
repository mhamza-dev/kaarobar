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
| `Kaarobar.Catalog` | Multi-industry catalog: barcodes, images, variants, modifiers, batches |
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

Demo seed: `owner@kaarobar.local` / `Password@123` (also `owner2@`–`owner4@`; staff `manager@` / `cashier@` / … and `*2@`–`*4@`)
Fresh data: `mix ecto.reset`

Dev-only credential browser (owners / staff / customer portal accounts from the DB): [http://localhost:4000/dev/creds](http://localhost:4000/dev/creds) — enabled only when `config :kaarobar, dev_routes: true` (dev.exs).

## Uploads / S3

Dev serves files from `priv/static/uploads` at `/uploads/...`.

For production (Cloudflare R2 / MinIO / AWS):

```bash
export STORAGE_BACKEND=s3
export S3_BUCKET=kaarobar-media
export S3_ACCESS_KEY_ID=...
export S3_SECRET_ACCESS_KEY=...
export S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
export S3_PUBLIC_URL=https://media.example.com
export S3_REGION=auto
```

## Tests

```bash
mix test
# Includes SEC-NFR-001 style tenancy isolation coverage
```

## Financial integrity (SRS ACC-FR-003 / ACC-FR-010)

- Journal lines must balance before post
- Posted entries are not edited/deleted; use reversing entries
- Sale/stock/journal mutations use DB transactions / atomic stock updates
