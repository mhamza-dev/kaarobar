# Kaarobar Web (`kaarobar-web`)

Next.js client for Kaarobar (SRS **KRB-SRS-003**). Product of **2ndHub Solutions**.

Public marketing (company site, product pages) lives in the separate **2ndHub Solutions** repo. This app starts at sign-in.

## Surfaces

| Surface | Audience | Behaviour |
|---------|----------|-----------|
| Auth (`/`, `/login`, `/signup`, `/forgot-password`) | Staff and customers | `/` redirects to `/login`. Use `?as=consumer` for marketplace shoppers. |
| Legal | Everyone | Privacy, Terms, Cookies (linked from signup). |
| App (`/app/*`) | Staff or customers | Same routes; UI switches by session actor. |

**Auth flow:** logged out → `/login`; after login → `/app`. Filesystem: `app/workspace/*` rewritten to `/app/*`.

## Consumer marketplace

With API + web running:

1. Sign in: [http://localhost:3000/login?as=consumer](http://localhost:3000/login?as=consumer)
2. Home `/app` lists branded stores; open a store at `/app/market/:id`
3. Cart → `/app/checkout` → `/app/checkout/pay` → orders at `/app/sales`

Demo seeds (after `mix ecto.setup` / `mix ecto.reset` in `kaarobar-BE`): see root README.

See also [docs/crm.md](../docs/crm.md).
