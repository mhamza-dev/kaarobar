# Kaarobar Desktop (`kaarobar-desktop`)

Electron **Cloud Desktop** POS terminal for Kaarobar SRS **KRB-SRS-004** (`OFF-FR-*` sync). Queues sales locally and syncs to Phoenix `kaarobar-BE`.

For the **one-time Offline Desktop Edition** (local SQLite, no day-to-day API), use [`kaarobar-desktop-offline`](../kaarobar-desktop-offline/) — see [`docs/offline-desktop.md`](../docs/offline-desktop.md).

The renderer is a **Vite + React + TypeScript + Tailwind** app that reuses the same UI components and page layouts as `kaarobar-web` for visual/UX parity. Electron `main` / `preload` keep offline IPC (`window.kaarobarPos`).

**Business-only:** desktop has no consumer / marketplace shell. Consumers use web (`/login?as=consumer`) or mobile. Login/register always send `actor: "business"`.

## Setup

```bash
npm install
npm run dev    # Vite + Electron (hot reload)
npm start      # production build then Electron
```

### Installers (no source upload)

```bash
npm run dist:mac    # → release/*.dmg
npm run dist:win    # → release/*.exe  (run on Windows or CI)
npm run dist:linux  # → release/*.deb  (run on Linux or CI)
```

CI publishes only these binaries to GitHub Releases (see `.github/workflows/desktop-release.yml`).

API base URL: `VITE_API_URL` (default `http://localhost:4000/api/v1`).

TanStack Query defaults: [`docs/architecture/client-cache-standards.md`](../docs/architecture/client-cache-standards.md).

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

Default Deep Sapphire tokens (`#1d4ed8` / rail `#0d1524`). Staff chrome remaps `--brand*` from the active business `primary_color` via `StaffBrandProvider` (Settings → Branding live-previews buttons/nav/inputs).
