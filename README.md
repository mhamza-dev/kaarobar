# Kaarobar

Kaarobar is a modern commerce platform built for small businesses that need a practical, reliable way to run sales, inventory, customer relationships, and operations across desktop, web, and mobile channels.

## Overview

From the storefront to the back office, Kaarobar brings essential business workflows into one connected ecosystem. The repository is organized as a multi-app product suite that supports daily operations for shops and service businesses.

## What Kaarobar does

- Runs shop operations through a desktop POS experience
- Supports offline-first selling and local day-to-day business work
- Tracks inventory, product movement, and purchasing
- Helps manage customer credit, sales history, and follow-up activity
- Gives owners and staff role-based access to the tools they need
- Extends into web and mobile experiences for broader business access

## Product areas

### Desktop

- [desktop/local](desktop/local) — primary local desktop application for shop operations
- [desktop/cloud](desktop/cloud) — cloud-connected or hosted companion desktop product

### Web

- [web/landing](web/landing) — public-facing marketing and brand experience
- [web/main](web/main) — main business web application

### Mobile

- [mobile/customer](mobile/customer) — customer-facing mobile experience
- [mobile/staff](mobile/staff) — staff-first operations experience

## Why it matters

Small businesses often juggle disconnected systems for POS, stock control, and customer management. Kaarobar is designed to reduce that fragmentation by unifying the core workflows that matter most in day-to-day operations.

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

## Tech stack

Kaarobar is built with a multi-platform modern stack:

- Electron for desktop-native app experiences
- React and Vite for web interfaces
- Next.js for web application surfaces
- React Native and Expo for mobile experiences
- TypeScript across frontend and application logic
- Node.js tooling for development and packaging

## Quick start

Each app in the repo has its own setup and runtime requirements. Start with the app you want to work on.

### Desktop app

```bash
cd desktop/local
npm install
npm run dev
```

### Web app

```bash
cd web/main
npm install
npm run dev
```

### Mobile app

```bash
cd mobile/staff
npm install
npm start
```

## Documentation

Relevant package-level documentation is maintained inside each app folder:

- [desktop/local/README.md](desktop/local/README.md)
- [desktop/local/FEATURES.md](desktop/local/FEATURES.md)
- [desktop/local/PHASE_GATES.md](desktop/local/PHASE_GATES.md)
- [desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md](desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md)

## Development notes

- This repository is a multi-project monorepo, not a single app.
- Each platform has its own requirements and setup flow.
- Secrets, local env files, generated builds, and platform artifacts should remain out of source control.

## License

Please refer to each package for specific licensing and distribution details where applicable.
