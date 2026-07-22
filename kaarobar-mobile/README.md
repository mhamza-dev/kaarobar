# Kaarobar Mobile (`kaarobar-mobile`)

Expo / React Native client for Kaarobar SRS **KRB-SRS-003**.

## Purpose

| Actor | Mobile use |
|-------|------------|
| Business | Dashboard, POS, customers, inventory, ESS, … |
| Consumer | Same `/app/*` routes; UI switches with `actor=consumer` |

## Unified login

Login toggle **Sign in as Consumer** posts `actor: "consumer"`. Business posts `actor: "business"`. Both land on `/app/dashboard`.

| Shared route | Business | Consumer |
|--------------|----------|----------|
| `/app/dashboard` | Hub | Discover stores |
| `/app/sales` | → POS | Order history |
| `/app/customers` | CRM | Loyalty |
| `/app/accounting` | (web/desktop) | Khata balance |
| `/app/market/:id` | — | Store checkout |

Demo consumer: `ayesha.customer@kaarobar-demo.pk` / `Password@123`

## Setup

```bash
npm install
npm start
```

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:4000/api/v1` (use your LAN IP for a physical device).
