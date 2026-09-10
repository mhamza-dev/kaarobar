# Kaarobar Staff Web App (`web/main`) — Frontend Implementation Plan

## Context

`web/main` is the staff-facing web client for Kaarobar's multi-tenant cloud POS platform — the app a business owner and their employees use in a browser (as opposed to `desktop/local`, the offline single-shop app, or `mobile/staff`). The Phoenix backend (`backend/`) is now substantially built — identity/RBAC, tenancy, catalog, pricing, inventory, purchasing, POS/sales, registers, customers/credit/loyalty, vertical modules (dining/kitchen, scheduling, service jobs, rentals, professional services), payments, billing, fiscal, reporting, RLS, realtime channels, MFA — roughly 250 REST endpoints under `/api/v1`. `web/main` itself is currently an untouched `create-next-app` scaffold: no components, no dependencies beyond Next/React/Tailwind, nothing built.

This plan phases the frontend build the same way the backend itself was planned (see `docs/can-you-please-create-enumerated-key.md`): a foundation phase, then domains in an order that keeps each phase demo-able against the real backend, later phases reusing what earlier ones establish rather than reinventing it. Two decisions are locked in already (confirmed with the user):

| Decision | Choice |
|---|---|
| Plan shape | Phased roadmap covering the whole platform, mirroring the backend plan's structure |
| Component library base | shadcn/ui (Radix primitives + Tailwind, code copied into the repo) themed with Kaarobar's brand tokens |
| Forms | Formik + Yup (locked by the user) |
| HTTP | Axios, via a services layer + custom hooks (locked by the user) — not Server Components/`fetch` caching |
| Icons | lucide-react (locked by the user) |

**Verified against the real backend source and the local Next.js 16 docs** (not assumed): the `/me` response shape (`me_json.ex` + `Serializers.scope/1`), the cursor-pagination contract (`pagination.ex` — `cursor`/`after` + `limit`/`per_page` params, `{"data", "meta": {"limit","has_more","next_cursor"}}` response), the login/MFA-challenge response shapes (`auth_json.ex`, `auth_controller.ex`), `GET /business-types` (`business_controller.ex#types` → `Verticals.grouped/modules/product_kinds`), and — importantly — that **Next.js 16 renames `middleware.ts` to `proxy.ts`** (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`; the exported function is `proxy`, not `middleware`, and the file must sit at the same directory level as `app/`, i.e. inside `src/` once that migration happens, not at the repo root). One correction to the initial design: a business's brand color is a flat `brand_color` string field on `businesses` (plus a separate `logo_url`), **not** a nested `branding` jsonb object — confirmed in `lib/backend/tenancy/business.ex` and `Serializers.business/1`.

---

## Architecture (Phase 0 — Foundation)

**Gate**: a user can register (owner + org + business + branch in one call), land on `/dashboard` inside a real app shell, see their name/business, log out; login + MFA challenge both work against the real backend; the reusable `DataTable`, `PageHeader`, and Formik/Yup form-bridge components exist and are exercised by the auth forms even though there's no CRUD screen yet.

### Folder structure

Introduce `src/` now — the only time this migration is free. `proxy.ts` sits inside `src/`, alongside `app/`, per the Next 16 doc's requirement ("same level as `pages` or `app`").

```
web/main/
├── src/
│   ├── proxy.ts                        # Next 16 route-protection entry point (replaces middleware.ts)
│   ├── app/
│   │   ├── layout.tsx                  # root layout: fonts, <Providers> (React Query, Toaster), html/body
│   │   ├── globals.css                 # Tailwind v4 @theme tokens
│   │   ├── (auth)/                     # unauthenticated route group, AuthShell layout
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── login/mfa/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (app)/                      # authenticated route group, AppShell layout
│   │   │   ├── layout.tsx              # session bootstrap (GET /me), AppShell mount — the real auth boundary
│   │   │   ├── dashboard/page.tsx
│   │   │   └── settings/... products/...   # added in Phase 1 / Phase 2
│   │   └── invite/[token]/page.tsx     # public invitation-accept flow, own minimal layout
│   ├── components/
│   │   ├── ui/                         # shadcn primitives (generated, themed)
│   │   ├── shared/                     # DataTable/, PageHeader.tsx, AppShell/, AuthShell.tsx,
│   │   │                               #   EmptyState.tsx, StatusBadge.tsx, ConfirmDialog.tsx,
│   │   │                               #   ColorPickerField.tsx, ErrorBoundary.tsx
│   │   └── forms/                      # Formik⇄shadcn bridge: FormTextField, FormNumberField,
│   │                                   #   FormSelectField, FormSearchSelectField, FormTextareaField,
│   │                                   #   FormCheckbox, FormSwitch, FormDatePicker
│   ├── features/                       # domain-scoped components (not routes): auth/, settings/, products/, ...
│   ├── services/                       # typed axios calls, one file per backend domain
│   ├── hooks/
│   │   ├── queries/                    # React Query hooks, 1:1 with services/*
│   │   ├── usePermission.ts, useDebounce.ts, useBrandTheme.ts, useToast.ts
│   ├── lib/
│   │   ├── api/{client.ts, errors.ts, pagination.ts}
│   │   ├── cn.ts, theme.ts, permissions.ts, nav.ts, verticals.ts,
│   │   │   formatMoney.ts, formatDate.ts, env.ts
│   ├── stores/{sessionStore.ts, uiStore.ts}   # zustand
│   └── types/api/*.ts                  # hand-written types mirroring backend *_json.ex shapes (no OpenAPI spec exists yet)
├── tsconfig.json                       # "@/*": ["./src/*"]
└── (next.config.ts, eslint.config.mjs, postcss.config.mjs unchanged)
```

`app/` stays thin — pages compose `features/*` and call `hooks/queries/*`; no axios calls or business logic directly in `page.tsx` files.

### Dependencies to add

```
# shadcn/ui foundation
class-variance-authority  clsx  tailwind-merge  tw-animate-css
lucide-react
@radix-ui/react-* (installed incrementally via the shadcn CLI per component, not all up front)
sonner            # shadcn's current toast solution
cmdk              # Command/combobox, backs FormSearchSelectField
next-themes       # light/dark

# Locked
formik  yup  axios

# Server/client state
@tanstack/react-query  (+ @tanstack/react-query-devtools, dev only)
zustand

date-fns

# Quality (new — none of this exists yet)
prettier  eslint-config-prettier
vitest  @vitejs/plugin-react  @testing-library/react  @testing-library/jest-dom  jsdom  msw
@playwright/test
```

**Why React Query over Server Components/`fetch` caching**: every backend call needs per-request `Authorization` + `X-Organization-Id`/`X-Business-Id`/`X-Branch-Id` headers whose values are UI-selectable state (the business switcher) — inherently client-interactive, awkward to thread through Server Component prop chains. The locked stack (axios + services + hooks) is the client-fetching pattern by design. React Query gives request de-dup/caching keyed by `[domain, businessId, params]`, mutation-driven invalidation, and composes naturally with the error envelope. Revisit only if a future data-heavy screen genuinely needs SSR streaming.

### Design tokens (Tailwind v4)

Port `desktop/local`'s token groups (brand, surface, ink, line, danger/success/warning, `shadow-soft/lift/glow`, 180ms transition) into `src/app/globals.css` via v4's CSS-first `@theme` block — **not** a `tailwind.config.js` (v4 doesn't use one) and **not** the v3-era `rgb(var(--x) / <alpha-value>)` channel-splitting trick (v4 generates opacity modifiers via `color-mix()` from plain hex/oklch values directly). Runtime per-business brand override (`useBrandTheme()` in `src/hooks/`, backed by `deriveBrandPalette()` ported from `desktop/local/src/lib/theme.ts` using `color2k`) writes plain hex strings via `document.documentElement.style.setProperty('--color-brand-primary', ...)`, sourced from the current business's `brand_color` field (confirmed flat string, not nested jsonb) — utility classes referencing `var(--color-brand-primary)` pick it up live. **Verify the exact opacity-modifier mechanics against the installed `tailwindcss` package before writing `globals.css`** — this is exactly the kind of v4 behavior `AGENTS.md` warns not to assume from training data.

### API client (`src/lib/api/client.ts`)

Single axios instance, `baseURL` from `NEXT_PUBLIC_API_URL` (validated in `src/lib/env.ts`).
- **Request interceptor**: `Authorization: Bearer <token>` + `X-Organization-Id`/`X-Business-Id`/`X-Branch-Id` (sourced from `sessionStore`) + auto-generated `Idempotency-Key` on POST/PUT/PATCH/DELETE (the backend expects this on every write).
- **Response/error interceptor**: unwraps `{"data": ...}`; maps `{"error": {"code","message","details"}}` into a typed `ApiError` (`.code`, `.message`, `.fieldErrors`) that a form's submit handler feeds to Formik's `setErrors`. 401 → clear session, redirect to `/login` (except on the login/verify calls themselves).
- **Cursor pagination helper** (`src/lib/api/pagination.ts`): wraps React Query's `useInfiniteQuery`, `getNextPageParam: (last) => last.meta.has_more ? last.meta.next_cursor : undefined`, matching the confirmed `cursor`/`limit`/`has_more`/`next_cursor` field names exactly.

**Token storage**: a JS-readable, non-httpOnly cookie (`kb_session`, `SameSite=Lax`, `Secure` in prod) set on login/MFA-verify success, mirrored into `sessionStore` (which the axios interceptor reads directly — no per-request cookie parsing). `src/proxy.ts` reads the same cookie for a **coarse, UX-only** redirect-to-`/login` when absent on an `(app)` route — it is not the authorization boundary. The real boundary is (a) the backend, which validates the bearer token on every request regardless, and (b) `(app)/layout.tsx`'s client-side `GET /me` bootstrap, which redirects on 401. This trades some XSS exposure for matching the locked axios/services stack; it's mitigated by the backend's revocable, DB-backed tokens (`POST /auth/logout-all`, per-device listing at `GET /me/devices`) — a compromised token can be revoked without a deploy. Flag an httpOnly-BFF proxy as the natural hardening upgrade if a future security review calls for it; not a Phase 0 blocker.

### Auth & route protection

- `src/proxy.ts`: matcher excludes `/api`, `/_next/*`, static assets, `(auth)` group; checks for `kb_session` cookie presence only (no decoding — it's an opaque bearer token), redirects to `/login?next=<path>` if absent.
- `src/app/(app)/layout.tsx` (Client Component): on mount, `useMe()` (React Query, `GET /me`) bootstraps `sessionStore` (user, organization, business, branch, `is_owner`, `roles`, `permissions`, `branch_ids`, `organizations` list — exact shape confirmed) and applies `useBrandTheme()` from `business.brand_color`. Full-page loading state until resolved; redirect to `/login` on error. All permission checks (`usePermission('staff:manage')`), vertical checks, and nav gating read from this bootstrapped state.
- **Login flow**: `POST /auth/login` → either a normal session or `{mfa_required: true, challenge}` (confirmed in `auth_controller.ex`/`auth_json.ex`). `LoginForm` branches accordingly; MFA path routes to `/login/mfa?challenge=...` → `MfaChallengeForm` posts `{challenge, code}` to `POST /auth/mfa/verify`.
- **Business switcher** (`src/components/shared/AppShell/BusinessSwitcher.tsx`): reads `organizations`/current selection from `sessionStore` (a user can belong to multiple orgs/businesses — confirmed via `/me`'s `organizations` array); on change, updates the header-source state in `sessionStore` and invalidates React Query caches (every list is tenant-scoped). New relative to `desktop/local` (which is single-shop) — state must live in the store, not a component, since the axios interceptor reads it too.

### Reusable component library

- **shadcn primitives** (`src/components/ui/*`, via CLI, themed against the tokens above): button, input, select, dialog, dropdown-menu, popover, command, tabs, checkbox, switch, label, tooltip, avatar, separator, scroll-area, accordion, badge, skeleton, sonner.
- **`DataTable`** (`src/components/shared/DataTable/DataTable.tsx`) — adapts `desktop/local`'s `Table<T>` API (render-prop columns, `rowKey`, selection-by-key, `mobileCard*` responsive degrade, `embedded`, `bulkActions`) for **cursor pagination**, which has no stable page-N or total count: pagination UI is "load more" / infinite-scroll style, `pageSizeOptions` default `[25, 50, 100]` (smaller than desktop/local's, since a cursor "page back" isn't free). Client-side `search`/`filters` operate only over already-fetched rows — document this plainly in the component; screens needing full-dataset search push filters to the backend as real query params instead (a per-screen decision).
- **Form bridge** (`src/components/forms/*`) — same `useField()` + prop-spread pattern as `desktop/local/src/components/form/FormTextField.tsx`, wrapping shadcn inputs instead of desktop's custom fields. `FormSearchSelectField` wraps shadcn's `command`+`popover` combo.
- **Layout**: `AppShell.tsx` — collapsible sidebar (state in `uiStore`), nav items from `src/lib/nav.ts`, driven entirely by backend data (`sessionStore.permissions` for permission gating, `sessionStore.business.business_type` cross-referenced against cached `GET /business-types` module data for vertical gating) — **not** a hardcoded frontend nav matrix. `PageHeader.tsx` mirrors desktop/local's title/description/actions/eyebrow slot API.
- **Confirm/toast**: `ConfirmDialog.tsx` on shadcn `dialog`; `sonner`'s `<Toaster />` in root layout + `useToast()` wrapper so every mutation's `onError` can call one helper that maps `ApiError.message` → `toast.error`.

### Services/hooks pattern — the template every later phase replicates

Four layers per domain, worked example for Staff:
1. `src/types/api/staff.ts` — hand-written types mirroring the backend's `*_json.ex`/`Serializers` output (no OpenAPI spec exists — types are hand-derived from `backend/lib/backend_web/controllers/*_json.ex`).
2. `src/services/staff.ts` — `listStaff`, `getStaff`, `updateStaff`, `setStaffRoles`, `setStaffBranches`: typed axios calls, nothing else.
3. `src/hooks/queries/useStaff.ts` — `useStaffList` (`useInfiniteQuery`, keyed `['staff', businessId, params]`), `useUpdateStaffRoles` (`useMutation` → invalidate + toast on error).
4. `src/features/settings/StaffTable.tsx` composes `DataTable` with these hooks; `src/app/(app)/settings/staff/page.tsx` is a thin `<PageHeader>` + `<StaffTable>` wrapper.

---

## Phase 1 — Settings / RBAC

**Gate**: an owner manages their organization, businesses (including brand color via `ColorPickerField`, proving the runtime brand-theme system end-to-end), branches, and staff (invite → assign roles → assign branches); a demo `cashier` account visibly sees a smaller `AppShell` sidebar than an `owner` — proving `usePermission()`/nav-gating for real.

- `settings/organization` — `PATCH /organization` via Formik/Yup, no table.
- `settings/businesses` (+ `[businessId]` detail) — `DataTable` over `GET /businesses`, edit form incl. `brand_color`/`logo_url`.
- `settings/branches` — `DataTable` + create/edit + "set main" (`POST /branches/:id/main`).
- `settings/staff` — `DataTable` over `GET /staff`, roles dialog (`PUT /staff/:id/roles`, multi-select over `GET /roles`), branch-assignment dialog (`PUT /staff/:id/branches`).
- `settings/staff/invitations` — `DataTable` over `GET /invitations`, invite dialog (`POST /invitations`). `src/app/invite/[token]/page.tsx` — the separate, unauthenticated invitee-accept flow (`GET /invitations/:token` → `POST /invitations/:token/accept`).
- `settings/roles` — `DataTable` over `GET /roles`; role editor using `GET /roles/permissions` (~140 keys, grouped) as grouped checkboxes — a one-off `features/settings/RoleEditor.tsx`, not forced into the generic form pattern.

## Phase 2 — Catalog / Products

**Gate**: three real CRUD domains now exist (Staff, Businesses/Branches, Products) on the same four-layer pattern, zero one-off table/form implementations — the actual proof the component library works.

- `products` — `DataTable` over `GET /products` (cursor-paginated); search via backend query param, not client-side (product lists can be large); filters for kind/category/status.
- `products/new` / `products/[productId]` — `kind` discriminator (`item|service|bundle|deal|rental|membership|gift_card|fee`) changes which fields apply (tracks_stock/batch/serial, is_weighted, service duration, kitchen station) — first real exercise of Formik conditional fields. Variant creation is an expandable section on the same page, not a separate route.
- `products/categories` — simpler `DataTable` + dialog, second low-risk instance proving the pattern generalizes.

---

## Remaining Phases (roadmap-level)

**Phase 3 — Inventory & Purchasing.** `/stock`, `/batches`, `/stock-transfers`, `/stock-counts`, `/suppliers`, `/purchase-orders`, `/goods-receipts`, `/supplier-bills`, `/purchase-returns`. Stock list, adjust/write-off dialogs, transfer create→dispatch→receive, count with variance approval, supplier CRUD, PO create→approve→receive. Introduces a `WorkflowActions` shared component (status-driven action bar next to `PageHeader`) — reused again by Phase 6.

**Phase 4 — POS / Sales / Registers.** `/registers`, `/shifts`, `/cash-movements`, `/orders`, `/sales`, `/payments`, `/returns`, `/refund-requests`. The largest, most complex phase — a mostly-client-state checkout UI (cart, multi-tender split payment, discounts, tax, barcode-scan), not a `DataTable` screen; register shift open/close; sales-history `DataTable` for review. **Deserves its own focused sub-plan when reached** rather than full detail now.

**Phase 5 — Customers, Credit & Loyalty.** `DataTable` + form pattern for customers/groups/addresses; customer detail page with tabs (ledger/credit/notes/follow-ups); aging report as a first taste of the reporting pattern Phase 8 does properly.

**Phase 6 — Vertical modules.** Dining/kitchen, scheduling/appointments, service-jobs, rentals, quotes. **Every route gated through `src/lib/nav.ts`/`verticals.ts` against `business_type` + `GET /business-types`** — a retail business must never see the kitchen board. Each vertical is its own mini-module reusing `DataTable`/forms/`WorkflowActions`; the kitchen board is the one screen needing custom real-time-feeling layout (the backend's `kds:*` Phoenix Channel is built for this).

**Phase 7 — Payments, Billing, Fiscal.** Payment provider config, subscription/plan display, fiscal config + submission log — mostly settings-style CRUD, straight `DataTable` reuse.

**Phase 8 — Reports & Documents.** First real charting (recommend `recharts`, added here not Phase 0) + CSV export links; receipt/invoice preview via iframe/print-view.

**Phase 9 — Hardening & polish.** Accessibility pass on custom components (`DataTable`, `AppShell` — shadcn/Radix gets most of this for free elsewhere); responsive/mobile audit (exercise `DataTable`'s mobile-card mode across every domain); loading/error/empty-state checklist; i18n decision point (`desktop/local` supports 7 languages incl. RTL — evaluate `next-intl` here if parity is needed, don't retrofit per-screen).

---

## Testing Strategy

Pragmatic, not infrastructure-heavy:
- **Unit (Vitest + Testing Library), from Phase 0**: pure `lib/*` functions (`deriveBrandPalette`, `can()`, pagination helpers, formatters).
- **Component (Vitest + Testing Library + MSW), from Phase 1**: `DataTable`, form-bridge components, `AppShell` nav-gating get real coverage (a bug here repeats across every domain); feature components get lighter smoke tests. MSW mocks axios against the confirmed response shapes.
- **E2E (Playwright), from end of Phase 1**: a short critical-path suite (register/login/MFA, invite-accept, one full CRUD cycle each on Staff and Products) against a real seeded backend, not mocked. Expand meaningfully only for Phase 4 (checkout) and Phase 6 (vertical flows) where end-to-end money/stock correctness matters.
- No visual regression/Storybook for v1.
- Add `test`/`test:e2e` scripts and a combined `lint && typecheck && test` script, mirroring the backend's `mix precommit` convention.

---

## Verification (per phase)

- `npm run dev` against a running backend (`cd backend && docker compose up` or local `mix phx.server`), exercise the phase's gate scenario by hand in the browser.
- `npm run lint`, `npx tsc --noEmit`, `npm test` all green before moving to the next phase.
- Phase 0: register → land on dashboard inside AppShell → log out; login with an MFA-enabled seeded account → challenge → verify → session.
- Phase 1: invite a staff member, accept via `/invite/[token]`, assign a restricted role, confirm their sidebar is visibly smaller than an owner's.
- Phase 2: create a product of each `kind`, confirm conditional fields render correctly, create a variant matrix.
