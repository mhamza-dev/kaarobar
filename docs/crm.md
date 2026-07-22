# CRM & Customer Portal (Phase A remaining)

Implementation notes for KRB-SRS-003 Phase A Should items shipped in code.

## Authority

- SRS: [`docs/srs/KRB-SRS-003.md`](srs/KRB-SRS-003.md) (Phase A remaining)
- Do not use archived KRB-SRS-002 for new work

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
- CRUD: `/api/v1/crm/templates`; preview: `POST /api/v1/crm/templates/preview`
- Defaults seeded per business on first list

### Paid messaging (internal wallet)

- `businesses.messaging_wallet_balance` + `messaging_wallet_ledger`
- Campaign fields: `budget_amount`, `estimated_cost`, `actual_cost`, `unit_cost_snapshot`, `template_id`
- Unit rates via `config :kaarobar, :messaging_unit_costs` (email/in_app free; SMS/WhatsApp charged)
- Send blocked with `budget_exceeded` / `insufficient_credits`
- Top-up: `POST /api/v1/crm/messaging-wallet/top-up` (owner MVP stub)

### Loyalty tiers / Coupons / SMS-WA

Unchanged from prior Phase A notes.

### Customer / Consumer identity (TEN-FR-014, CUS-FR-*)

- Tables: `customer_accounts`, `customer_sessions` (separate from business `users`)
- **Unified auth:** `POST /api/v1/auth/login|register` with `actor: "business" | "consumer"` (aliases `staff`/`buyer` accepted)
- Invite accept: `POST /api/v1/auth/buyer/accept-invite` → `/login?as=consumer&invite=…`
- Self-service APIs (consumer Bearer): `/api/v1/portal/me`, `/orders`, `/loyalty`, `/ar`, …

## Clients

- **Web:** filesystem `app/workspace/*` rewritten to browser `/app/*`; marketing at `/app/marketing` (campaigns, templates, wallet, segments, coupons, tiers)
- **Mobile:** Expo routes under `/app/*` (shared business/consumer shells)
- **Desktop:** HashRouter `/app/*`, business-only; marketing page mirrors web templates/wallet
- Actors: login toggle **Business** / **Consumer** (`?as=consumer`)

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
