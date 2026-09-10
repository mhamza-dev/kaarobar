# Kaarobar — Staff Web App

The browser client a business owner and their staff run the shop from. Talks
to the Phoenix API in [`backend/`](../../backend) over REST; it is one of
several clients (`desktop/cloud`, `mobile/staff`) built against that same
contract.

Not to be confused with `desktop/local`, the separately sold offline
single-shop app. That one is a useful _reference_ for how these workflows
behave in a real shop — its component APIs and design tokens are echoed here
deliberately — but it shares no code and no database with this.

## Stack

|              |                                                               |
| ------------ | ------------------------------------------------------------- |
| Framework    | Next.js 16 (App Router), React 19                             |
| Language     | TypeScript, strict                                            |
| Styling      | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| Components   | shadcn/ui on Base UI primitives, in `src/components/ui`       |
| Icons        | lucide-react                                                  |
| Forms        | Formik + Yup                                                  |
| HTTP         | axios, through a typed services layer                         |
| Server state | TanStack React Query                                          |
| Client state | zustand                                                       |
| Tests        | Vitest + Testing Library (unit), Playwright (e2e)             |

## Running it

```bash
cp .env.example .env.local     # points at http://localhost:4000/api/v1
npm install
npm run dev                    # http://localhost:3000
```

You need the backend running alongside it:

```bash
cd ../../backend && mix phx.server
```

| Script             |                                                          |
| ------------------ | -------------------------------------------------------- |
| `npm run check`    | lint + typecheck + unit tests — run before every commit  |
| `npm test`         | Vitest unit suite                                        |
| `npm run test:e2e` | Playwright, against a **running** backend and dev server |
| `npm run format`   | Prettier                                                 |

## Layout

```
src/
├── app/                  App Router — routing and layout only
│   ├── (auth)/           login, MFA challenge, register, password reset
│   └── (app)/            everything behind a session; AppShell lives here
├── components/
│   ├── ui/               shadcn primitives (generated — edit to theme, not to restructure)
│   ├── shared/           app-wide: AppShell, PageHeader, AuthShell, DataTable
│   └── forms/            the Formik ⇄ shadcn bridge
├── features/             domain-scoped components, composed by pages
├── services/             typed axios calls, one file per backend domain
├── hooks/queries/        React Query hooks, paired 1:1 with services
├── lib/                  api client, permissions, nav, theme, formatting
├── stores/               zustand: session (token + tenant), UI state
├── types/api/            hand-written mirrors of the backend's JSON shapes
└── proxy.ts              Next 16's route-protection convention
```

Pages stay thin: they compose `features/*` and call `hooks/queries/*`. No
axios calls or business logic in `app/**/page.tsx`.

## Conventions

**Four layers per domain.** `types/api/x.ts` → `services/x.ts` →
`hooks/queries/useX.ts` → `features/x/*.tsx`, consumed by a thin page. Every
new domain follows the same shape; `services/auth.ts` and
`hooks/queries/useAuth.ts` are the worked example.

**Types are hand-written from the backend source.** There is no OpenAPI spec
yet, so `src/types/api/*` mirrors `backend/lib/backend_web/controllers/*_json.ex`
and `serializers.ex` by hand. When an endpoint's shape changes, read the
Elixir, don't guess.

**Everything goes through `src/lib/api/client.ts`.** One axios instance
attaches the bearer token, the `X-Organization-Id`/`X-Business-Id`/`X-Branch-Id`
tenant headers, and an `Idempotency-Key` on every write. It maps the backend's
`{"error": {...}}` envelope into a typed `ApiError`, whose `fieldErrors` feed
straight into Formik via `applyApiFieldErrors`.

**Lists are cursor-paginated, not paged.** The backend returns
`{"data": [...], "meta": {"has_more", "next_cursor"}}` — there is no total and
no page N. `DataTable` is built around "load more", and client-side search
only filters rows already fetched; anything needing full-dataset search pushes
filters to the backend as query params.

**Permission and vertical gating comes from `/me`.** `scope.permissions` (with
the owner bypass mirrored from `Kaarobar.Scope.can?/2`) drives
`src/lib/permissions.ts`; `scope.business.modules`, resolved server-side by
`Kaarobar.Verticals`, drives which nav items a business type even sees. There
is no hardcoded frontend copy of either matrix.

**Auth boundaries, in order.** `src/proxy.ts` does a coarse cookie-presence
redirect (UX only — the token is opaque, nothing is decoded). `(app)/layout.tsx`
does the real work: `GET /me` proves the token, hydrates the session store, and
settles on a business to act within. The backend validates every request
regardless; the frontend never decides authorization on its own.

**Base UI, not Radix.** shadcn's current registry builds on `@base-ui/react`.
Two differences bite when porting older snippets: composition uses a `render`
prop, not `asChild`, and a `DropdownMenuLabel` must sit inside a
`DropdownMenuGroup` or it throws at runtime.

## Where this is going

Built so far — Phase 0 of
[the plan](../../docs): design tokens, the component library foundation, the
API client, session bootstrap with business auto-selection, the app shell, and
the full auth surface (register, login, TOTP challenge, password reset), all
covered end-to-end by `e2e/`.

Next: Settings/RBAC (organization, businesses, branches, staff, invitations,
roles), then Catalog, then inventory/purchasing, POS, CRM, the vertical
modules, payments/billing, and reporting.
