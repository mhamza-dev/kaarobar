# Kaarobar Customer (`mobile-consumer`)

Expo (React Native) client for **end customers** (marketplace / portal).

## Purpose

Discover stores, place pickup orders, book appointments (salon / `appointments_enabled`), loyalty/khata, alerts, and account. Staff POS is in [`kaarobar-mobile`](../kaarobar-mobile).

## Tabs

Discover · Orders (pickup orders **and** appointments) · Loyalty · Alerts · Account

Store detail exposes **Shop** and/or **Book** from catalog goods vs services + `appointments_enabled` (CUS-FR-005 / SCH-FR-001). Booking: service → optional staff → slot → `POST /portal/appointments`. Orders tab lists and cancels Booked appointments via portal APIs.

## Setup

```bash
npm install
npm start          # Metro + Expo dev server
```

Then press `a` / `i` in the Expo CLI, or scan the QR code with **Expo Go** —
every native module this app uses ships inside Expo Go.

To build and run the native app locally instead (generates `android/` / `ios/` first):

```bash
npm run android    # expo run:android
npm run ios        # expo run:ios  (macOS only)
```

Set `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:4000/api/v1`). Only
`EXPO_PUBLIC_*` variables are inlined into the bundle; use your machine's LAN IP
for a physical device.

Demo consumer: `ayesha.customer@kaarobar-demo.pk` / `Password@123`

## Native projects (CNG)

`android/` and `ios/` are **not** committed — they are generated from
[`app.json`](./app.json):

```bash
npx expo prebuild --clean
```

Never hand-edit the generated projects; change `app.json` or add a config plugin
instead. Release APKs are signed with [`credentials/debug.keystore`](./credentials),
which CI copies into `android/app/` after prebuild.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run doctor     # expo-doctor: dependency/SDK compatibility
```

## Stack

- **Expo SDK 57** · React Native 0.86 · React 19 · New Architecture
- React Navigation 7 (native stack + bottom tabs)
- Same Phoenix `/api/v1` base URL pattern as other Cloud clients
- Theme/i18n duplicated locally (no new shared package)
- TanStack Query — see [`docs/architecture/client-cache-standards.md`](../docs/architecture/client-cache-standards.md)
