# Kaarobar

Kaarobar is a multi-platform commerce and operations ecosystem for small businesses, spanning desktop, web, and mobile experiences. The repository currently contains a desktop POS application, a cloud/web app, and mobile apps for staff and customers.

## Overview

This monorepo brings together the business tools needed to run a shop or service business across multiple channels:

- Desktop POS for offline-first retail operations
- Web dashboard and storefront experience
- Mobile apps for staff and customer interactions
- Shared business logic and multi-platform product structure

## Monorepo structure

```text
kaarobar/
├── README.md
├── .gitignore
├── package-lock.json
├── desktop/
│   ├── local/
│   └── cloud/
├── web/
│   ├── landing/
│   └── main/
├── mobile/
│   ├── customer/
│   └── staff/
└── ...
```

## Applications in this repo

### Desktop

- [desktop/local](desktop/local) — local/offline desktop application for shop operations
- [desktop/cloud](desktop/cloud) — cloud-connected desktop product or hosted companion app

### Web

- [web/landing](web/landing) — marketing or public landing site
- [web/main](web/main) — main web application

### Mobile

- [mobile/customer](mobile/customer) — customer-facing mobile app
- [mobile/staff](mobile/staff) — staff-facing mobile app

## Tech stack

The project uses a modern multi-app stack, including:

- Electron and desktop native tooling for local desktop apps
- React / Vite / Next.js for web experiences
- React Native / Expo for mobile apps
- TypeScript across apps and shared code
- Node.js-based tooling and package management
- Local and cloud-ready architecture depending on the app

## Quick start

Each app has its own dependencies and scripts. For the desktop local app:

```bash
cd desktop/local
npm install
npm run dev
```

For web apps:

```bash
cd web/main
npm install
npm run dev
```

For mobile apps:

```bash
cd mobile/staff
npm install
npm start
```

## Documentation

The app-level documentation lives in each package folder:

- [desktop/local/README.md](desktop/local/README.md)
- [desktop/local/FEATURES.md](desktop/local/FEATURES.md)
- [desktop/local/PHASE_GATES.md](desktop/local/PHASE_GATES.md)
- [desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md](desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md)

## Notes

- This repository is organized as a multi-project monorepo rather than a single app.
- Apps may have different runtime and build requirements depending on their platform.
- Environment variables, generated build artifacts, and local secrets should remain out of version control.

## License

Please refer to each app package for its respective licensing and distribution details where applicable.
