# Kaarobar Desktop (`kaarobar-desktop`)

Electron POS terminal for Kaarobar SRS **KRB-SRS-003**.

The renderer is a **Vite + React + TypeScript + Tailwind** app that reuses the same UI components and page layouts as `kaarobar-web` for visual/UX parity. Electron `main` / `preload` keep offline IPC (`window.kaarobarPos`).

**Business-only:** desktop has no consumer / marketplace shell. Consumers use web (`/login?as=consumer`) or mobile. Login/register always send `actor: "business"`.

## Setup

```bash
npm install
npm run dev    # Vite + Electron (hot reload)
npm start      # production build then Electron
```

API base URL: `VITE_API_URL` (default `http://localhost:4000/api/v1`).

Demo login after seed: `owner@kaarobar.local` / `Password@123`

## Screens (match Web staff)

- Dashboard, POS, Returns, Inventory, Accounting, HR, Reports
- Notifications, Settings (Subscriptions / Integrations / Roles), Profile
- Staff tools (ESS): clock / leave / payslips

## Architecture

| Layer | Path |
|-------|------|
| Electron main + IPC | `src/main.js`, `src/preload.js` |
| React renderer (source) | `renderer/` |
| Production UI build | `dist/` (loaded by Electron) |
| Legacy vanilla UI (retired) | `src/renderer-legacy/` |

## Theme

Deep Sapphire design tokens from Web `globals.css` (`#1d4ed8` / rail `#0d1524`).
