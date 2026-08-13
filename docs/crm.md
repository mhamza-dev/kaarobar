# CRM & Customer Portal (Phase A remaining)

Implementation notes for KRB-SRS-004 Phase A Should items shipped in code.

## Authority

- SRS: [`docs/srs/KRB-SRS-004.md`](srs/KRB-SRS-004.md) (Phase A remaining)
- Prefer module docs + requirement index for day-to-day work; do not invent Out-of-Scope features

## Backend (`kaarobar-BE`)

### Consent (CRM-FR-009)

Customer flags: `marketing_opt_in_email`, `marketing_opt_in_sms`, `marketing_opt_in_whatsapp` (default false). Campaign audience resolution suppresses opted-out recipients per channel.

### Segments (CRM-FR-001 / CRM-FR-012)

- Table: `campaign_segments` (`name`, `filters` JSON)
- Filters supported: `khata_enabled`, `min_points`, `loyalty_tier_id`, `inactive_days`
- `POST /api/v1/crm/campaigns/preview` returns audience size **and** paid-messaging cost estimate
- Campaigns may use `audience: "segment"` + `segment_id`

### Message templates

- Table: `crm_message_templates` (`name`, `channel`, `title_template`, `body_template`, `variables`)
- CRUD: `/api/v1/crm/templates`; show: `GET /api/v1/crm/templates/:id`; preview: `POST /api/v1/crm/templates/preview`
- Variables catalog: `GET /api/v1/crm/templates/variables` — flat `{{key}}` placeholders (`business`, `tagline`, `description`, sample `name`/`points`) with live examples (CRM-FR-002)
- Preview merges live business branding vars: `{{business}}`, `{{tagline}}`, `{{description}}` (plus request `variables`)
- Defaults seeded per business on first list
- Channel `in_app` delivers to portal `customer_account_id` when linked (legacy `customers.user_id` still supported)

### Business branding (marketplace + templates)

- Fields on `businesses`: `tagline`, `logo_key`, `primary_color`, `marketplace_description`
- Owner: `PATCH /businesses/:id`; logo `POST|DELETE /businesses/:id/logo`
- Public marketplace serialize includes `logo_url`, `tagline`, `primary_color`, `marketplace_description`
- Settings UI: Branding tab (web + desktop)

### Public marketplace product feed (CUS-FR-012)

- `GET /api/v1/marketplace/products?q=&category=&industry=&limit=&cursor=`
- Active products only from active businesses with `marketplace_enabled`
- Each row: product id/name/price/`image_url`/category/`product_kind`, plus `business_id` / `business_name` / `business_slug` / `industry`
- Price is the online-branch branch price when configured; `cursor` is an opaque offset for the next page (`meta.next_cursor`)
- Existing store discovery: `GET /marketplace/businesses` (+ `/:id`, `/:id/catalog`)

### Consumer in-app notifications

- `notifications.customer_account_id` (XOR with `user_id`)
- Portal: `GET /portal/notifications`, `/unread-count`, `POST …/:id/read`, `POST …/read-all`
- Types: `order.placed`, `order.status_changed`, `crm.campaign` (+ staff `order.online_placed`)
- Online sales default status `Placed`; staff `PATCH /sales/:id/status` → Confirmed → Ready → Completed | Cancelled

### Paid messaging (Safepay pay-to-send)

- Free channels (`email`, `in_app`): send as before (wallet unused when cost is 0)
- Paid channels (`sms`, `whatsapp`): **Pay & send** → `POST /crm/campaigns/:id/checkout` creates `campaign_payments` + Safepay one-time checkout (PKR); webhook (or dev `confirm-payment`) marks paid and sends
- Direct `POST …/send` on unpaid paid-channel returns `402 payment_required`
- Ledger still records `campaign_spend`; wallet may be credited then debited on Safepay success
- Free stub top-up removed (`POST …/messaging-wallet/top-up` → 410)
- Requires `SAFEPAY_API_KEY` + `SAFEPAY_SECRET_KEY`; without keys uses `dev_fallback` confirm-payment path

### Loyalty tiers / Coupons / SMS-WA

Unchanged from prior Phase A notes.

### Customer / Consumer identity (TEN-FR-014, CUS-FR-*)

- Tables: `customer_accounts`, `customer_sessions` (separate from business `users`)
- **Unified auth:** `POST /api/v1/auth/login|register` with `actor: "business" | "consumer"` (aliases `staff`/`buyer` accepted)
- Invite accept: `POST /api/v1/auth/buyer/accept-invite` → `/login?as=consumer&invite=…`
- Self-service APIs (consumer Bearer): `/api/v1/portal/me`, `/orders`, `/loyalty`, `/ar`, `/notifications`, …
- **Portal-linked customers:** once `customers.customer_account_id` is set, staff cannot change identity (`name` / `email` / `phone` / profile pic). `PATCH /customers/:id` only accepts store fields (khata, credit, notes, marketing, etc.). Offline (unlinked) customers remain fully editable.

## Clients

- **Web:** filesystem `app/workspace/*` rewritten to browser `/app/*`; marketing at `/app/marketing` (campaigns, templates, wallet, segments, coupons, tiers)
- **Consumer cart:** persistent multi-store cart (localStorage / AsyncStorage); navbar cart → `/app/checkout` review (grouped by store) → `/app/checkout/pay` places one pickup order per store with shared contact notes; branded Discover + store catalog; shared `ListingFilters` on catalog and staff DataTable products
- **Branding UI scheme:** business `primary_color` remaps `--brand*` (web) / brand palette (mobile) for staff workspace and consumer store/checkout controls
- **Mobile:** Expo (React Native) — staff in `kaarobar-mobile`, consumers in `mobile-consumer` (Discover / orders / appointments); same cart/checkout API paths
- **Desktop:** HashRouter `/app/*`, business-only; marketing page mirrors web templates/wallet
- Actors: web login supports Business / Consumer; mobile apps are split by audience (no shared login toggle)

## Config

```elixir
config :kaarobar,
  sms_adapter: Kaarobar.Messaging.Sms.Mock,
  whatsapp_adapter: Kaarobar.Messaging.Whatsapp.Mock,
  messaging_unit_costs: %{
    "email" => "0",
    "in_app" => "0",
    "sms" => "2.50",
    "whatsapp" => "3.00"
  }
```
