# Kaarobar Phase Gates

Checklist before shipping a build or merging substantial product work. Reflects the **current single-shop** stage (not the early multi-business scaffold plan).

## Standard gate

- `npm run typecheck` passes.
- `npm run build:app` passes (or the target `build:*` script for the release you are shipping).
- App launches; critical path is manually exercised once.
- New IPC handlers validate session role and business/branch scope in the main process.
- New forms use Formik + Yup with shared `Form*` wrappers.
- New accent UI uses dynamic `brand-*` tokens (preset colors + on-primary contrast).
- New user-facing strings exist in both `src/i18n/en.json` and `src/i18n/ur.json`; Urdu layout remains RTL-safe.

## Product checks (current stage)

- **Setup:** License activation → Fresh vs Restore choice → (Fresh) owner + business/branch + language complete and reach login.
- **Restore:** Setup Restore (or Backup page restore) accepts a `.kaarobar-backup` file and boots into a usable shop state.
- **Single shop:** One business per install; no multi-business switcher in the UI. Scoped lists use the active business only.
- **Auth:** Login guard and role gates deny unauthorized routes/actions.
- **Staff:** Owner/Admin can create, edit, and deactivate users.
- **Branding:** Preset brand swatches update runtime CSS variables; on-primary text remains readable.
- **Business settings:** Section cards save; social fields denormalize in the form and persist correctly.
- **Catalog:** Product/category CRUD persists and validates.
- **Purchasing:** PO receive updates stock and PO status.
- **POS:** Barcode scan adds a product or offers quick-create; sale persists atomically with stock/payment updates (cash/card/credit).
- **Receipts:** Print and reprint succeed.
- **Customers / credit:** Credit sale updates customer balance; ledger remains consistent.
- **Refunds:** Void/refund creates an audit-safe reversal and restocks when applicable.
- **Dashboard:** Analytics summary for **7 / 30 / 90** days loads; four charts render with hover tooltips (no IPC crash on bad `days`).
- **i18n:** EN ↔ UR switch updates strings and document direction.
- **Motion / empty states:** Nav pill, page transitions, skeletons, and empty states remain non-blocking.
- **Backup:** Create writes an encrypted `.kaarobar-backup`; restore replaces data as documented on the Backup page.
- **Installers:** Target platform artifact appears under `release/<version>/` (see README build scripts).

## Obsolete (do not reintroduce)

- ~~Owner switches between multiple businesses~~ — removed; product is single-tenant / single-shop.
