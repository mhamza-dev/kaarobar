# Kaarobar Web (`kaarobar-web`)

Next.js client for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.3 / §8.1)

| Surface | Audience | Behaviour |
|---------|----------|-----------|
| Marketing site (`/`) | Prospects | Product story: multi-business POS + books + HR, Pakistan/FBR ready |
| Auth (`/login`, `/signup`) | Owners | Email/password → JWT session (TEN-FR-006) |
| App (`/app/*`) | Owner, Manager, Accountant, Inventory, HR, Cashier (browser POS) | Dashboard, POS, inventory, accounting, HR shells |
| Customer Portal (`/portal/*`) | Customers | Orders, loyalty, khata/AR — separate login from staff |

**Auth flow:** logged out → landing; logged in (staff) → `/app` dashboard. Customers use `/portal/login` (not staff auth).

## Customer Portal

With API + web running:

1. Open [http://localhost:3000/portal/login](http://localhost:3000/portal/login)
2. Enter **Business ID** (UUID from seed output or staff app), customer **email**, and **password**
3. After sign-in: `/portal` (orders, loyalty, AR)

Demo seeds (after `mix ecto.setup` / `mix ecto.reset` in `kaarobar-BE`):

| Field | Value |
|-------|--------|
| Password | `Password@123` |
| Emails | `ayesha.customer@kaarobar-demo.pk`, `admin@neighborhoodclinic.pk`, `procurement@hotelsupplies.pk`, `raza.traders@kaarobar-demo.pk` |
| Business ID | Printed in the seed summary for `owner@kaarobar.local` businesses |

Self-register: `/portal/register` when the business has `portal_self_register` enabled. Staff can set a portal password on the customer form under `/app/customers`.

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
