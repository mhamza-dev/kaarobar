# Kaarobar

Kaarobar is a multi-platform commerce platform for small businesses that need a simple, reliable way to sell, manage stock, track customers, and operate across desktop, web, and mobile channels.

## GitHub project presentation

This repository is organized as a product monorepo with different application surfaces built for different business needs:

- Desktop POS for in-shop operations and offline-first sales workflows
- Cloud/web experience for business management and broader access
- Mobile apps for staff and customer interactions
- Shared product structure designed for business continuity and expansion

The project is positioned as a practical business operating system for shops and service businesses, with a focus on real-world retail workflows rather than generic app scaffolding.

## Investor / client-facing summary

Kaarobar addresses a common operational problem for small businesses: fragmented tools for sales, inventory, customer tracking, and payments. The platform is designed to bring these systems together into one cohesive experience, helping owners and staff work faster with less manual effort.

Key value points:

- Offline-first desktop operation for reliable local selling
- Inventory and purchase workflows for better stock control
- Customer credit and sales tracking for simplified business accountability
- Role-based access for staff, managers, and owners
- Multi-platform presence across desktop, web, and mobile
- A practical focus on everyday shop operations, not just showroom dashboards

## Repository structure

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

## Applications

### Desktop

- [desktop/local](desktop/local) — local/offline desktop application for core shop operations
- [desktop/cloud](desktop/cloud) — cloud-connected desktop or hosted companion platform

### Web

- [web/landing](web/landing) — public-facing landing page or marketing experience
- [web/main](web/main) — main web application for management and digital access

### Mobile

- [mobile/customer](mobile/customer) — customer-facing mobile app
- [mobile/staff](mobile/staff) — staff-focused mobile operations app

## Tech stack

The project uses a modern multi-platform stack:

- Electron for desktop native experiences
- React + Vite + Next.js for web interfaces
- React Native / Expo for mobile apps
- TypeScript across application layers
- Node.js tooling and package-based project management
- Local-first and cloud-ready architecture depending on app needs

## Developer onboarding guide

### Prerequisites

Install the latest stable versions of the following tools:

- Node.js
- npm
- Git
- A code editor such as VS Code

### Recommended workflow

1. Clone the repository
2. Open the app you want to work on
3. Install dependencies in that app folder
4. Run the local development command for that app
5. Keep each app isolated by platform and service responsibility

### Run the apps

Desktop local app:

```bash
cd desktop/local
npm install
npm run dev
```

Web main app:

```bash
cd web/main
npm install
npm run dev
```

Mobile staff app:

```bash
cd mobile/staff
npm install
npm start
```

### Development conventions

- Keep app-specific logic inside each package folder
- Avoid mixing web, mobile, and desktop concerns in one project folder
- Use environment variables for secrets and local configuration
- Treat generated build and output folders as non-source artifacts
- Verify app-specific docs before changing behavior or build configuration

### Useful project notes

- This repository is structured as a multi-project monorepo, not a single app.
- Not every app shares the same runtime and tooling requirements.
- Generated files, local secrets, cache folders, and environment files should not be committed.

## Documentation

The detailed docs for the desktop implementation live in the local app package:

- [desktop/local/README.md](desktop/local/README.md)
- [desktop/local/FEATURES.md](desktop/local/FEATURES.md)
- [desktop/local/PHASE_GATES.md](desktop/local/PHASE_GATES.md)
- [desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md](desktop/local/WINDOWS_RELEASE_SMOKE_TEST.md)

## Notes

This project is designed to support real business operations, especially within retail and service environments. The platform evolves around practical workflows such as sales, inventory, customer management, and everyday staff coordination.

## License

Please refer to each package for its own licensing and release details where applicable.
