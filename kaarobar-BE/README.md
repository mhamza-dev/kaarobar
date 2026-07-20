# Kaarobar Backend (Elixir / Phoenix)

API for the Kaarobar multi-tenant POS, accounting, and HR platform.

## Setup

```bash
# from repo root
docker compose up -d   # optional if you already have Postgres locally

cd kaarobar-BE
mix deps.get
mix ecto.setup
mix phx.server
```

API: `http://localhost:4000/api/v1`

Demo seed user: `owner@kaarobar.local` / `password123`

## Contexts

- `Kaarobar.Accounts` — auth
- `Kaarobar.Tenancy` — businesses, branches, memberships
- `Kaarobar.Pos` — sales, tills, returns
- `Kaarobar.Inventory` — products, stock, PO/GRN, transfers
- `Kaarobar.Accounting` — COA, journals, statements
- `Kaarobar.Hr` — employees, attendance, leave, payroll
- `Kaarobar.Billing` — subscription limits / LemonSqueezy webhook
- `Kaarobar.Integrations.Fbr` — Tier-1 reporting adapter
- `Kaarobar.Reporting` — owner dashboard

## Tests

```bash
mix test
```
