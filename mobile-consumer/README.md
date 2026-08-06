# Kaarobar Customer (`kaarobar-customer`)

React Native CLI client for **end customers** (marketplace / portal).

## Purpose

Discover stores, place pickup orders, book appointments (salon / `appointments_enabled`), loyalty/khata, alerts, and account. Staff POS is in [`kaarobar-mobile`](../kaarobar-mobile).

## Tabs

Discover · Orders (pickup orders **and** appointments) · Loyalty · Alerts · Account

Store detail exposes **Shop** and/or **Book** from catalog goods vs services + `appointments_enabled` (CUS-FR-005 / SCH-FR-001). Booking: service → optional staff → slot → `POST /portal/appointments`. Orders tab lists and cancels Booked appointments via portal APIs.

## Setup

```bash
npm install
npm start
npm run ios   # or android
npm run typecheck
```

`API_URL` defaults to `http://localhost:4000/api/v1`.

Demo consumer: `ayesha.customer@kaarobar-demo.pk` / `Password@123`

## Stack

- React Native 0.76 + React Navigation
- Same Phoenix `/api/v1` base URL pattern as other Cloud clients
- Theme/i18n duplicated locally (no new shared package)
- TanStack Query — see [`docs/architecture/client-cache-standards.md`](../docs/architecture/client-cache-standards.md)
