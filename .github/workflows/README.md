# CI/CD Secrets Setup

These workflows deploy on push to `main` (or build artifacts).

## Required GitHub repository secrets

### Vercel (`web-vercel.yml`)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Render (`backend-render.yml`)
- `RENDER_DEPLOY_HOOK_URL` (optional) — from Render → your web service → **Settings → Deploy Hook**  
  If unset, the deploy job skips. Prefer enabling **Auto-Deploy** on the Render service from GitHub instead (or use both carefully — that can double-deploy).

## Backend on Render (Neon DB)

1. Create a Neon Postgres database; copy the connection string (`?sslmode=require`).
2. In Render, create a **Web Service** from this repo with:
   - **Root Directory:** `kaarobar-BE`
   - **Language:** Elixir
   - **Build Command:** `./build.sh`
   - **Start Command:** `_build/prod/rel/kaarobar/bin/server`
   - **Pre-Deploy Command:** `_build/prod/rel/kaarobar/bin/migrate`
3. Environment variables (minimum):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon URL (`postgresql://…?sslmode=require` or `ecto://…`) |
| `SECRET_KEY_BASE` | `mix phx.gen.secret` |
| `GUARDIAN_SECRET_KEY` | `mix phx.gen.secret` |
| `PHX_SERVER` | `true` (also set by `bin/server`) |
| `STORAGE_BACKEND` | `local` until S3 is configured |
| `MIX_ENV` | `prod` |

Do **not** paste shell prompts into Build/Start (no `kaarobar-BE/ $ …`). Root Directory already `cd`s into `kaarobar-BE`.

4. Point web/mobile/desktop `*_API_URL` at `https://<your-service>.onrender.com/api/v1`.

## Notes
- **Mobile** (`mobile-apk.yml`) publishes **APKs only** to a GitHub Release (`android-<sha>`):
  - `Kaarobar-staff.apk`
  - `Kaarobar-customer.apk`
- **Desktop** (`desktop-release.yml`) publishes **installers only** to a GitHub Release (`desktop-<sha>`):
  - macOS `.dmg`
  - Windows `.exe` (NSIS)
  - Linux `.deb`
- We do **not** upload `src/` or source zips. GitHub may still show auto-generated “Source code” links for the tag on public repos — keep the repo private if you need those hidden.
- Installers/APKs are unsigned CI builds until you add Apple/Windows/Android signing secrets.
- Optional Blueprint: repo-root `render.yaml`.
