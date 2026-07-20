# Kaarobar

Unified POS, Accounting & Workforce Management Platform for multi-business, multi-branch owners.

## Repository layout

```
POS/
├── kaarobar-web/       # Next.js — marketing site + authenticated dashboard/POS
├── kaarobar-mobile/    # React Native (Expo) — owner/manager + employee self-service
├── kaarobar-desktop/   # Electron — offline-capable POS terminal
├── kaarobar-BE/        # Elixir/Phoenix API + PostgreSQL
├── docs/               # ADRs and architecture notes
└── docker-compose.yml  # Postgres + Redis for local development
```

Each client is independently deployable (no shared npm packages). Visual theme tokens are duplicated per app so branding stays consistent without coupling releases.

## Theme (all clients)

| Token | Value |
|-------|-------|
| Brand | `#1d4ed8` Deep Sapphire |
| Accent | `#0f766e` Teal |
| Background | `#f4f7fb` |
| Heading | `#0f172a` |
| Sidebar | `#0b1220` |

## Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16, React 19, Tailwind CSS 4 |
| Mobile | Expo / React Native |
| Desktop | Electron |
| API | Elixir, Phoenix, Ecto, Oban, Guardian |
| Database | PostgreSQL 16 |

## Quick start

```bash
# Backend
cd kaarobar-BE && mix setup && mix phx.server

# Web (http://localhost:3000) — landing when logged out, /app when logged in
cd kaarobar-web && npm install && npm run dev

# Mobile
cd kaarobar-mobile && npm install && npm start

# Desktop POS
cd kaarobar-desktop && npm install && npm start
```

Demo user after seeding: `owner@kaarobar.local` / `password123`
