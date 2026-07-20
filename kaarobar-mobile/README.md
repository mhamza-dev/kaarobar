# Kaarobar Mobile (`kaarobar-mobile`)

Expo / React Native client for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.2 / §2.3 / §8.1)

| Actor | Mobile use |
|-------|------------|
| Business Owner | Consolidated dashboard, approvals, alerts (G1) |
| Branch Manager | Approvals (returns/leave) when away from the till |
| Employee | ESS only: clock in/out, leave request, payslips (HR-FR-002/005/011) |

**Auth flow:** Landing → Sign in / Sign up → Dashboard. Unauthenticated users cannot open dashboard/ESS.

## Out of scope on mobile (v1)

Full accountant ledger UI, heavy inventory procurement, offline Electron sync — those stay on web/desktop per SRS client split.

## Setup

```bash
npm install
npm start
```

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:4000/api/v1` (use your LAN IP for a physical device).

## Theme

Same Deep Sapphire tokens as web/desktop (`lib/api.ts` → `colors`).
