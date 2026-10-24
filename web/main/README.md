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

## The interface

**The frame.** From `md` up the sidebar and a thin margin make a frame, and
each screen is a raised panel inside it (`AppShell`); on a phone the panel is
the whole screen and the sidebar is a drawer. Colours, radii and shadows are
tokens in `globals.css` — the frame is `--sidebar`, the panel `--canvas`,
cards `--card` — and every text pair is checked for 4.5:1 in both themes.
A business's brand colour replaces `--primary` at runtime.

**Every screen names its tab.** `PageHeader` renders a `<title>` ("Products ·
Kaarobar"), and a record's page passes `documentTitle` so the tab says which
one ("FC-2026-0011 · Kaarobar"). The root layout deliberately sets no
`metadata.title`: Next re-inserts it ahead of the page's own on every
client-side navigation, and the browser shows the first.

**The till** (`features/pos`) is a product grid with category chips beside a
basket that never scrolls its pay button out of view. The scan box is also
the search: Enter looks the text up as a barcode, then falls back to the
first product shown. One tender for the whole sale is a single "Charge"
tap; "Add payment" splits it. Prices still only ever come from
`POST /sales/quote` — the pay buttons wait while a basket is being re-priced.

**The keyboard.** <kbd>⌘K</kbd>/<kbd>Ctrl K</kbd> searches screens,
<kbd>?</kbd> lists every shortcut, <kbd>G</kbd> then a letter jumps to a
screen (only ones the person can open — `lib/shortcuts.ts`), and at the till
<kbd>/</kbd> focuses the scan box and <kbd>⌘/Ctrl Enter</kbd> charges.

**Installable.** `app/manifest.ts` and the icons in `app/` and `public/` let a
shop add Kaarobar to a counter PC's taskbar or a phone's home screen. The
icons are drawn from the same mark as `LogoMark`.

## Signing up and paying

The marketing site ([`web/landing`](../landing)) sends every "Start free
trial" to `/register?plan=<code>`. The form preselects that plan (the middle
one otherwise), creates the account, starts the plan's trial — no card — and
lands the new owner on `/welcome`: their trial, the desktop and mobile apps,
and a setup checklist. A signed-in visitor with `?plan=` goes to the billing
screen instead.

`/settings/billing` handles the rest. With card billing configured on the
backend (`checkout_enabled` from `GET /plans`) it offers Stripe Checkout —
"Add a card" during a trial, which still charges only when the trial ends —
and, once card-billed, Stripe's customer portal for changes and cancelling.
Without it, plans are invoiced. Coming back from Stripe it polls until the
webhook has landed.

Account banners above every screen say when the trial is nearly over, a
payment has failed, the subscription has lapsed, or the email address isn't
confirmed. A lapsed organization's API calls answer 402, and the client sends
the user to the billing screen.

The backend's emails link to `/reset-password/<token>`, `/invitations/<token>`
and `/confirm-email/<token>`; all three exist here and are open to visitors
without a session.

### Optional settings

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL`,
`NEXT_PUBLIC_IOS_APP_URL` and `NEXT_PUBLIC_ANDROID_APP_URL` (see
`.env.example`) — the welcome screen says "Coming soon" for any app that isn't
published yet.

## Where this is going

Built so far — every phase of [the plan](../../docs), the detail-page pass
(A0–B5), and the purchase flow above. All of it is covered by `e2e/`.
