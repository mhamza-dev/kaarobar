# Kaarobar Desktop (`kaarobar-desktop`)

Electron POS terminal for Kaarobar SRS **KRB-SRS-001**.

## Purpose (SRS §2.3 / §8.1 / §10)

Primary actor: **Cashier / POS Operator** (highest-frequency, lowest-friction till UI). Also usable by Branch Managers for till reconciliation.

| Capability | Requirement |
|------------|-------------|
| Online checkout | POS-FR-001–006 |
| Offline cache + outbox | OFF-FR-001–004 (SQLite sync Phase) |
| Idempotent sync | `client_txn_id` (OFF-FR-003) |
| Peripherals | ESC/POS printer, USB-HID scanner, cash drawer (POS-FR-014 / §8.2) |
| FBR on reconnect | OFF-FR-006 / FBR-FR-004 (async, never blocks sale) |

**Auth flow:** Sign in → Owner/branch dashboard → Open POS till. Session stored locally for the terminal.

## Setup

```bash
npm install
npm start
```

API: `http://localhost:4000/api/v1` (see `src/renderer/app.js`).

Windows 10/11 primary; macOS secondary (COMP-NFR-002).

## Theme

Deep Sapphire (`#1d4ed8` / sidebar `#0b1220`) aligned with web and mobile.
