# Kaarobar Web (`kaarobar-web`)

Next.js client for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.3 / §8.1)

| Surface | Audience | Behaviour |
|---------|----------|-----------|
| Marketing site (`/`) | Prospects | Product story: multi-business POS + books + HR, Pakistan/FBR ready |
| Auth (`/login`, `/signup`) | Owners | Email/password → JWT session (TEN-FR-006) |
| App (`/app/*`) | Owner, Manager, Accountant, Inventory, HR, Cashier (browser POS) | Dashboard, POS, inventory, accounting, HR shells |

**Auth flow:** logged out → landing; logged in → `/app` dashboard.

## SRS-aligned product copy

Landing sections map to SRS scope: Owner→Business→Branch hierarchy, POS/Inventory/Accounting/HR modules, offline desktop POS, FBR Tier-1, subscription billing (LemonSqueezy).

## Setup

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                  # http://localhost:3000
```

Requires `kaarobar-BE`. Demo: `owner@kaarobar.local` / `password123`

## Theme

Deep Sapphire design system in `app/globals.css` — keep mobile/desktop tokens in sync (PORT-NFR-002 spirit without shared packages).
