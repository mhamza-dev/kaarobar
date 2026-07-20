# Kaarobar Mobile (`kaarobar-mobile`)

Expo / React Native client for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.2 / §2.3 / §8.1)

| Actor | Mobile use |
|-------|------------|
| Business Owner | Dashboard, business/branch switcher, approvals |
| Branch Manager | Returns approve/reject, till history, inventory glance |
| Cashier / Ops | Light POS checkout when away from desktop till |
| Employee | ESS — clock, leave, payslips |

## Feature coverage

| Area | Mobile screens |
|------|----------------|
| Auth / tenancy | Login, signup, dashboard + business/branch chips |
| Online POS | `/pos` — till open/close, cart qty, split pay, invoice # |
| Returns / procurement | `/returns`, `/inventory` (stock, suppliers, PO/GRN, transfers, adjust) |
| HR ESS | `/ess` — clock in/out, leave requests, payslip history |

## Setup

```bash
npm install
npm start
```

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:4000/api/v1` (use your LAN IP for a physical device).

Demo login after seed: `owner@kaarobar.local` / `Password@123`  
ESS demo: `cashier@kaarobar.local` / `Password@123` (linked to an employee on seed)

## Theme

Same Deep Sapphire tokens as web/desktop (`lib/api.ts` → `colors`).
