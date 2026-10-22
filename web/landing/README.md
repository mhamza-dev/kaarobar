# Kaarobar — Marketing Site

The public site at the front of the product: what Kaarobar is, who it's for,
what it costs, and where to get it. Every "Start free trial" ends at the web
app's sign-up ([`web/main`](../main)) with the plan already chosen.

## Running it

```bash
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3001
```

Port 3001, so it runs beside the web app on 3000. The pricing page reads the
live plan catalogue from the API, so run the backend too
(`cd ../../backend && mix phx.server`). Without it the site still renders and
says prices couldn't be loaded, rather than inventing them.

| Script              |                              |
| ------------------- | ---------------------------- |
| `npm run check`     | lint + typecheck             |
| `npm run build`     | production build             |

## Pages

| Route         |                                                                            |
| ------------- | -------------------------------------------------------------------------- |
| `/`           | Hero, industries, feature highlights, platforms, how it works, pricing, FAQ |
| `/features`   | Every feature area, anchored (`/features#inventory`)                         |
| `/industries` | One section per business-type group, anchored                                |
| `/pricing`    | Plan cards, a full comparison table, billing FAQ                             |
| `/download`   | Web, desktop and mobile — store links from env, "Coming soon" when unset     |
| `/about`      | Story and principles                                                         |
| `/contact`    | Sales / support / general email, optional WhatsApp                           |
| `/privacy`, `/terms` | Plain-language starting points — **have them reviewed before launch** |

Plus `sitemap.xml`, `robots.txt` and the app icon, from the metadata file
conventions.

## How buying works

1. **Pricing** — plans come from the API's public `GET /plans` (cached five
   minutes), the same catalogue the web app's billing screen shows. Nothing
   here hard-codes a price.
2. **Start free trial** links to `<APP>/register?plan=<code>`. The sign-up
   form preselects that plan and starts its trial with the account — no card.
   A visitor who's already signed in goes to the billing screen instead.
3. **Welcome** — the new owner lands on `/welcome` in the web app: their
   trial, links to the desktop and mobile apps, and a setup checklist.
4. **Paying** — from the billing screen, by card through Stripe Checkout when
   the backend has `STRIPE_BILLING_SECRET_KEY`; otherwise by invoice. The
   pricing FAQ follows the API's `checkout_enabled` so it never promises card
   payment a deployment doesn't take.

## Where the words live

All copy — features, industries, FAQs, module names for the comparison table —
is in [`lib/content.ts`](lib/content.ts), apart from the page layouts, so it
can be edited (and checked against what the product really does) in one place.
Every feature claimed there exists in the backend today. The pricing table
only lists modules that have a friendly name there; a module key without one is
treated as internal and left off.

## Configuration

See [`.env.example`](.env.example). `KAAROBAR_API_URL` is read on the server
only; the `NEXT_PUBLIC_*` values are inlined at build time, so changing one
means rebuilding.
