# Kaarobar Backend

The multi-tenant cloud API behind Kaarobar's subscription products. One owner
runs one or many businesses, each with many branches and many employees whose
roles are scoped per business and per branch, across every kind of business —
retail, clothing, grocery, restaurant, café, salon, laundry, repair, pesticides,
pharmacy, rentals, professional services.

**Clients:** `desktop/cloud`, `web/main`, `mobile/staff` (and `mobile/customer`
later). The contract between them and this application is the OpenAPI spec.

**Not a client:** `desktop/local`. That is a separately sold, offline,
single-shop product with its own SQLite database and its own licence server.
There is no sync between the two and no shared storage. Its schema and domain
logic are a useful *reference* for how these workflows behave in a real shop,
nothing more.

## Stack

| | |
|---|---|
| Runtime | Elixir 1.20.4 on OTP 28.4.3 |
| Web | Phoenix 1.8 (JSON only — no HTML, no asset pipeline) |
| Server | Bandit |
| Database | PostgreSQL 17 |
| Jobs | Oban |
| Auth | DB-backed hashed bearer tokens (Argon2 passwords) |
| Encryption | Cloak, for gateway credentials, TOTP secrets and PII |

## Running it

Requires Elixir 1.20.4 on OTP 28.4.3 and PostgreSQL 17. With `asdf` or `mise`
the repo-root `.tool-versions` pins both.

```bash
cd backend
mix setup                 # deps.get, create, migrate, seed
mix test
mix precommit             # compile --warnings-as-errors, format, credo, sobelow, test
mix phx.server            # http://localhost:4000
```

Seed a worked example — one organization, one business per vertical, staff in
every role:

```bash
SEED_DEMO=true mix run priv/repo/seeds.exs
```

### Without Elixir installed

Everything also runs through Docker, which is how it was developed:

```bash
cp .env.example .env
docker compose up -d db
docker compose run --rm app mix deps.get
docker compose run --rm app mix ecto.setup
docker compose run --rm app mix test
docker compose up app
```

### Health

| Route | Purpose |
|---|---|
| `GET /api/v1/health` | Liveness. Touches nothing external. |
| `GET /api/v1/ready` | Readiness. Verifies the database answers. |

`/dev/dashboard` (LiveDashboard) and `/dev/mailbox` are available in
development only.

## What is built

Phases 0 and 1 of the plan. Everything below is implemented, migrated and
tested; the later phases build on these foundations without changing them.

| Area | State |
|---|---|
| Docker + release tooling, health probes, error envelope, cursor pagination | done |
| Identity: registration, sign-in, bearer tokens per device, password reset, email confirmation | done |
| Tenancy: organizations, businesses, branches, ownership transfer | done |
| RBAC: 147 permissions, 12 system roles, custom roles, per-person allow/deny grants, rank-based escalation guards | done |
| Staff: invitations, memberships, branch scoping, register PINs | done |
| Audit trail: append-only, database-enforced | done |
| Idempotency: per-organization keys with replay | done |
| Vertical registry: 30 business types → modules, product kinds, required sale fields | done |
| Catalog, pricing, tax | phase 2 |
| Inventory, purchasing | phase 3 |
| POS checkout, registers, shifts | phase 4 |
| Customers, credit, loyalty | phase 5 |
| Vertical modules (tables, KDS, appointments, service jobs, rentals) | phase 6 |
| Payments, fiscal, subscription billing | phase 7 |
| Reporting, documents | phase 8 |
| Realtime, RLS, OpenAPI | phase 9 |

Some conventions below describe tables that arrive in later phases. They are
stated now because the code that lands then has to follow them.

## Conventions

These are load-bearing. Breaking one does not fail loudly, it fails quietly and
in production.

**Every context function takes `%Kaarobar.Scope{}` first.** The scope carries
the user, their organization, the selected business and branch, their resolved
permission set and their plan entitlements. It is built once per request. A
query against a tenant table goes through `Kaarobar.Repo.Scoped`, which raises
if the scope lacks the tenant it needs rather than returning unfiltered rows.

**Schemas `use Kaarobar.Schema`, not `Ecto.Schema`.** That gives time-ordered
UUIDv7 primary keys and microsecond timestamps. The v7 keys are why cursor
pagination can page on `id` alone.

**Money is `Decimal` on `numeric(16,4)`, and serialises as a string.** JSON
numbers are doubles in every JavaScript client we ship; a POS that silently
rounds a total is not a POS.

**Inventory truth is the `stock_moves` ledger.** `stock_items.on_hand` is a
projection maintained in the same transaction under a row lock — never written
independently.

**Every write endpoint honours `Idempotency-Key`.** Shop connections drop
mid-request; a retry must not charge twice or decrement stock twice.

**Errors use one envelope**, whatever the source:

```json
{ "error": { "code": "validation_failed",
             "message": "The submitted data is invalid",
             "details": { "email": ["has already been taken"] } } }
```

**Lists are cursor-paginated**, never offset-paginated:

```json
{ "data": [ … ], "meta": { "limit": 50, "has_more": true, "next_cursor": "0195…" } }
```

## Verticals

`Kaarobar.Verticals` maps one of 30 `business_type` values to the modules it may use, the
product kinds its catalog may contain, and the fields its sales must carry.
It is pure data: adding a vertical is an entry in that module, not a migration.
A restaurant gets tables and a kitchen display; a salon gets appointments and
commissions; a pesticide dealer gets enforced batch and expiry tracking; a
laundry gets job intake through to collection. They all share one `products`,
one `sales` and one `stock_moves` table.

## Layout

```
lib/backend/          Kaarobar.*      — domain contexts
lib/backend_web/      KaarobarWeb.*   — router, controllers, plugs, channels
priv/repo/migrations/                 — schema history
test/                                 — mirrors lib/
```

Note the directory/module mismatch (`lib/backend/` holds `Kaarobar.*`): the OTP
application is `:backend` while the namespace is `Kaarobar`. That is how the
project was generated; follow it.
