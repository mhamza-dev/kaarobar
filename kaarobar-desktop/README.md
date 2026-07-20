# Kaarobar Desktop (`kaarobar-desktop`)

Electron POS terminal for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.3 / §8.1 / §10)

Primary actor: **Cashier / POS Operator**. Also usable by Branch Managers for till reconciliation and returns.

| Capability | Status |
|------------|--------|
| Auth + business/branch select | Done |
| Online checkout + tills + split pay | Done |
| Returns, till history, inventory procurement | Done |
| Offline SQLite outbox | Deferred |
| Peripherals (ESC/POS, scanner, drawer) | Deferred |

## Screens

- **Dashboard** — KPIs + business/branch selectors
- **POS** — products, till open/close, qty ±, split tender, invoice number
- **Returns** — sale lookup, refund method, approve/reject, till history
- **Inventory** — on-hand, products, suppliers, PO/GRN, transfers, adjustments

## Setup

```bash
npm install
npm start
```

API base URL is set in `src/renderer/app.js` (`http://localhost:4000/api/v1`).

Demo login after seed: `owner@kaarobar.local` / `Password@123`

## Theme

Deep Sapphire (`#1d4ed8` / sidebar `#0b1220`) aligned with web and mobile.
