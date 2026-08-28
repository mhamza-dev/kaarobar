# Kaarobar

Kaarobar is an offline-first desktop Point of Sale and business management system for a single shop. The project is centered around the Electron + React desktop app in [local-desktop](local-desktop), with local SQLite storage, role-based access control, inventory workflows, customer credit tracking, and encrypted backup/restore support.

## Project overview

This repository currently contains the desktop application package and supporting docs for a single-business retail workflow. After initial license activation, the app is designed to run primarily offline, preserving sales workflows even when internet connectivity is unavailable.

### Core capabilities

- Offline-first POS with barcode-driven checkout
- Inventory and supplier management
- Purchase orders and stock receiving
- Sales history, refunds, and customer credit ledger
- Role-based permissions for owner, admin, manager, and cashier users
- Dashboard analytics with sales trends and payment breakdowns
- Business setup, branding, and localized UI
- Encrypted backup and restore for shop data and media
- Desktop installers for macOS, Windows, and Linux

## Repository structure

```text
kaarobar/
├── README.md
├── package-lock.json
├── local-desktop/
│   ├── README.md
│   ├── FEATURES.md
│   ├── PHASE_GATES.md
│   ├── WINDOWS_RELEASE_SMOKE_TEST.md
│   ├── package.json
│   ├── electron/
│   ├── src/
│   ├── shared/
│   ├── fixtures/
│   ├── public/
│   └── scripts/
└── ...
```

The actual application code lives in [local-desktop](local-desktop).

## Tech stack

- Electron for the desktop shell and native integrations
- React + TypeScript + Vite for the renderer UI
- Tailwind CSS for styling
- SQLite via better-sqlite3 for local data storage
- Formik + Yup for form validation
- i18next for multilingual UI support
- Supabase for license activation and related setup checks
- Recharts and Framer Motion for analytics and UI polish

## Quick start

```bash
cd local-desktop
npm install
npm run dev
```

This starts the app with native module rebuild support for Electron and launches the desktop environment in development mode.

## Useful commands

```bash
cd local-desktop

npm run typecheck
npm run lint
npm run build:app
npm run build:mac
npm run build:win
npm run build:linux
```

## Documentation

The package-specific documentation is in the app folder:

- [local-desktop/README.md](local-desktop/README.md)
- [local-desktop/FEATURES.md](local-desktop/FEATURES.md)
- [local-desktop/PHASE_GATES.md](local-desktop/PHASE_GATES.md)
- [local-desktop/WINDOWS_RELEASE_SMOKE_TEST.md](local-desktop/WINDOWS_RELEASE_SMOKE_TEST.md)

## Notes

- This project is intended for a single business/tenant per installation.
- License activation is handled during setup, and daily operations are designed to continue offline after activation.
- Real environment secrets such as Supabase keys and license secrets should not be committed to source control.

## License

This project is under the repository's existing licensing terms. See the app package and project documentation for the commercial and operational details specific to the Kaarobar desktop build.
