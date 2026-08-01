# Kaarobar Mobile (`kaarobar-mobile`)

React Native CLI client for **business / staff** (KRB-SRS-003).

## Purpose

Staff POS, sales, products, customers, settings (including ESS Attendance). Consumer marketplace lives in [`kaarobar-customer`](../kaarobar-customer).

## Tabs

POS · Sales · Products · Customers · Settings  
Attendance (clock in/out, leave, payslips) is under **Settings → Attendance**.

## Setup

```bash
npm install
npm start
# then in another terminal:
npm run ios
# or
npm run android
```

Set `API_URL` (defaults to `http://localhost:4000/api/v1`). Use your LAN IP for a physical device.

Demo staff: `owner@kaarobar.local` / `Password@123`

## Stack

- React Native 0.76 + React Navigation (native stack + bottom tabs)
- AsyncStorage session, duplicated theme/i18n (no shared npm package)
