# Kaarobar Web (`kaarobar-web`)

Next.js client for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.3 / §8.1)

| Surface | Audience | Behaviour |
|---------|----------|-----------|
| Marketing site (`/`) | Prospects | Product story: multi-business POS + books + HR, Pakistan/FBR ready |
| Auth (`/login`, `/signup`) | Business & consumers | Shared sign-in; **`?as=consumer`** / Sign in as Consumer sends `actor=consumer` |
| App (`/app/*`) | Business or consumers | Same routes; UI switches by session actor (`as`) |

**Auth flow:** logged out → landing; after login → `/app` (business dashboard or consumer discover). Filesystem: `app/workspace/*` rewritten to `/app/*`.

## Consumer marketplace

With API + web running:

1. Sign in: [http://localhost:3000/login?as=consumer](http://localhost:3000/login?as=consumer)
2. Home `/app` lists stores; order at `/app/market/:id`
3. Shared routes: `/app/sales` (orders), `/app/customers` (loyalty), `/app/accounting` (khata)

Demo seeds (after `mix ecto.setup` / `mix ecto.reset` in `kaarobar-BE`):

| Field | Value |
|-------|--------|
| Password | `Password@123` |
| Emails | `ayesha.customer@kaarobar-demo.pk`, `admin@neighborhoodclinic.pk`, `procurement@hotelsupplies.pk`, `raza.traders@kaarobar-demo.pk` |

Seeded demo businesses are marketplace-listed. Staff owners can toggle marketplace under **Settings → Integrations**. Online sales appear via `GET /sales?source=online`.

Staff can attach a customer to a buyer account (invite email → `/login?as=consumer&invite=…`).

See also [docs/crm.md](../docs/crm.md).

## SRS-aligned product copy

Landing sections map to SRS scope: Owner→Business→Branch hierarchy, POS/Inventory/Accounting/HR modules, offline desktop POS, FBR Tier-1, subscription billing (LemonSqueezy).

## Setup

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                  # http://localhost:3000
```

Requires `kaarobar-BE`. Demo: `owner@kaarobar.local` / `Password@123`

## Theme

Deep Sapphire design system in `app/globals.css` — keep mobile/desktop tokens in sync (PORT-NFR-002 spirit without shared packages).
