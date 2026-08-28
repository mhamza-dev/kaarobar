# Windows Release Smoke Test

Verify a client-ready Windows build from a clean machine. macOS/Linux packaging uses the same app; adjust only the installer step for those platforms (`build:mac` / `build:linux`).

## 1) Build installer

- Run `npm run build:win` (or `npm run build:all` if shipping every platform).
- Confirm artifacts under `release/<version>/`, typically:
  - `Kaarobar-Windows-<version>-Setup.exe` (NSIS)
  - `Kaarobar-Windows-<version>-Portable.exe`

## 2) Clean VM install

- Use a fresh Windows VM with no previous Kaarobar app data.
- Install the NSIS `.exe` (or run the portable binary).
- Launch the app and confirm the setup wizard opens.

## 3) Activation + offline validation

- Keep internet **on** for license activation (setup Step 1).
- Choose **Start fresh** (or exercise **Restore** with a known-good `.kaarobar-backup` in a separate pass).
- Complete owner + business + branch + language.
- Close the app.
- Disconnect VM internet.
- Relaunch and confirm login + dashboard work fully offline.

## 4) Functional offline checks

- Create a staff user, product, supplier, and purchase order; receive stock.
- Run one barcode-backed POS sale (cash or card).
- Record one credit sale and verify customer balance update.
- Print and reprint a receipt.
- Open Dashboard; switch **7 / 30 / 90** day ranges and confirm charts load.
- Create a backup and confirm a `.kaarobar-backup` file is written.

## 5) Restore check

- Restore from the backup path (Backup page or setup Restore).
- Relaunch and verify core records remain accessible.
- Confirm there is still a single shop (no business switcher).

## 6) Release gate

- No console/runtime errors on the critical path.
- All key modules function offline after activation.
- NSIS uninstall keeps app data unless the user explicitly removes it (`deleteAppDataOnUninstall: false`).
