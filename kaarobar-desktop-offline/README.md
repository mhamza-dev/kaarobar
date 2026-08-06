# Kaarobar POS

Offline-first desktop Point of Sale for a **single shop** (one business / tenant per install). Built with Electron, React, TypeScript, SQLite (`better-sqlite3`), Tailwind, and Formik + Yup.

License activation uses Supabase during setup; day-to-day sales and inventory run fully offline after activation.

## Current stage

Working product surface (not a scaffold-only demo):

- **Setup** — license → Fresh vs Restore → owner → business/branch → language (EN, UR, DE, PT, ES, FR, AR; RTL for Urdu & Arabic)
- **Auth & roles** — owner / admin / manager / cashier with route and IPC permission gates
- **Dashboard** — KPIs plus 4 Recharts charts (sales trend, transactions, payment mix, top products); range **7 / 30 / 90** days; hover tooltips use brand colors
- **POS** — barcode-backed checkout (cash / card / credit), receipts (print / reprint)
- **Catalog & purchasing** — products, suppliers, purchase orders / stock receive
- **Sales & customers** — sales history, customer detail, credit balances; refunds where permitted
- **Staff** — create / edit / deactivate users (owner/admin)
- **Business settings** — section cards; preset brand color swatches (no free color picker) with on-primary contrast; denormalized social link fields
- **Backup** — encrypted `.kaarobar-backup` create/restore (Backup page + setup Restore path)
- **UI** — shared Table / Card / inputs / Button; animated nav pill (`LayoutGroup`); POS layout redesign

Single-shop model: the app scopes data to the one configured business. There is **no** multi-business switcher.

## Stack

| Layer | Tech |
|---|---|
| Desktop | Electron 43, electron-builder |
| UI | React 18, Vite 5, Tailwind 3, Framer Motion, Recharts, Lucide |
| Data | better-sqlite3 (main process), electron-store |
| Forms / i18n | Formik, Yup, i18next (EN, UR, DE, PT, ES, FR, AR) |
| Shared | `shared/types`, `shared/auth/permissions` via `@shared` |

## Requirements

- Node **≥ 26.5.0** and npm **≥ 11** (see `.nvmrc`)
- Native rebuild for Electron is handled by `rebuild:native` / `postinstall`

## Develop

```bash
npm install
npm run dev
```

`dev` rebuilds native modules for the current Electron version, then starts Vite + Electron with HMR.

**Test shop backup:** [`fixtures/kaarobar-test-app.kaarobar-backup`](./fixtures/kaarobar-test-app.kaarobar-backup) is a full demo shop with history from **1 Jan 2025 → today** (5–20 sales/day, expanded customers/products/suppliers/POs). During setup choose **Restore** and pick that file (license with `KAAROBAR-DEV-LOCAL` when applicable). Regenerate with `npm run generate:test-backup`.

Demo logins (password `Password@123`):

| Email | Role | Use to verify |
|---|---|---|
| `owner@kaarobar.test` | Owner | Full access |
| `admin@kaarobar.test` | Admin | Full shop access (Users, Business settings, Restore) |
| `manager@kaarobar.test` | Manager | No Users / Business settings / Restore |
| `cashier@kaarobar.test` | Cashier | POS, Sales, Customers, Create PO, Create Backup only |
| `cashier2@kaarobar.test` | Cashier | Second cashier account |

RBAC smoke check after restore: log in as each role and confirm sidebar + forbidden actions match the table above.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build:app   # compile renderer + main only (no installer)
```

## Environment

Create `.env.development` / `.env.production` locally (both are gitignored). Vite injects these into the Electron main bundle:

| Variable | Purpose |
|---|---|
| `KAAROBAR_SUPABASE_URL` | License activation API |
| `KAAROBAR_SUPABASE_ANON_KEY` | Supabase anon key |
| `KAAROBAR_LICENSE_SECRET` | License crypto / related secrets |

Optional: `KAAROBAR_BACKUP_SECRET` — encrypts `.kaarobar-backup` files. If unset, falls back to `KAAROBAR_LICENSE_SECRET`, then a local dev default.

Do not commit real secrets. For local license work without a configured server, development may accept a local/dev key path (see licensing service).

**Device identity:** License seats use a stable machine fingerprint (OS hardware UUID when available, otherwise a durable `device.id` under `2ndHub/Kaarobar` outside the wipeable Kaarobar app data folder). Wiping `Application Support/Kaarobar` and reinstalling on the same computer should not consume an extra device seat after re-activation with the same key. Older installs migrate automatically from the previous hostname/MAC-based fingerprint.

## Build & share installers

Artifacts land in `release/<version>/` (e.g. `release/0.1.0/`). That folder is gitignored.

| Script | What it builds |
|---|---|
| `npm run build:mac` | macOS DMG (`Kaarobar-Mac-<ver>-Installer.dmg`) |
| `npm run build:win` | Windows NSIS + portable (`…-Setup.exe`, `…-Portable.exe`) |
| `npm run build:linux` | Linux AppImage (+ deb target; see note) |
| `npm run build:all` | mac + win + linux targets above |
| `npm run build` | Default electron-builder run for the host platform |

Mac builds set `CSC_IDENTITY_AUTO_DISCOVERY=false` (unsigned / ad-hoc friendly for sharing). Clients on macOS may need to allow an unsigned app via Gatekeeper.

**Linux:** Prefer sharing `Kaarobar-Linux-<ver>-x86_64.AppImage`. Cross-building `.deb` from macOS often produces a broken stub — build the `.deb` on a Linux host if you need it.

After a successful build, send the platform-specific file from `release/<version>/` to the client. Smoke-test Windows installs with [WINDOWS_RELEASE_SMOKE_TEST.md](./WINDOWS_RELEASE_SMOKE_TEST.md).

## Project structure

```
electron/          Main process: IPC, SQLite, auth, licensing, backup, receipts
src/               React renderer (features, components, stores, i18n)
  features/        setup, auth, license, admin pages, POS helpers
  components/      ui, form, layout, brand
shared/            Cross-process types and permission helpers
build/             electron-builder resources
release/           Installer output (generated)
```

IPC is exposed only through the preload `window.api` bridge (`contextIsolation: true`, `nodeIntegration: false`).

## Docs

| File | Purpose |
|---|---|
| [FEATURES.md](./FEATURES.md) | Feature list and how each helps shop users |
| [PHASE_GATES.md](./PHASE_GATES.md) | Regression / release checklist for the current stage |
| [WINDOWS_RELEASE_SMOKE_TEST.md](./WINDOWS_RELEASE_SMOKE_TEST.md) | Clean Windows VM install + offline smoke test |
