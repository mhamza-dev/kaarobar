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
- `POST /api/v1/crm/campaigns/preview` returns audience size
- Campaigns may use `audience: "segment"` + `segment_id`

### Loyalty tiers (CRM-FR-007 Should)

- Table: `loyalty_tiers` (`min_points`, `earn_rate`, `redeem_rate`)
- Recomputed on loyalty adjust / sale earn
- CRUD: `/api/v1/crm/loyalty-tiers`

### Coupons (CRM-FR-005 / CRM-FR-014 / POS-FR-019)

- Tables: `coupons`, `coupon_redemptions`
- POS checkout accepts `coupon_code`
- Marketing CRUD + `POST /api/v1/crm/coupons/validate`

### SMS / WhatsApp (CRM-FR-003 / CRM-FR-004)

- Campaign `channel`: `email` | `in_app` | `sms` | `whatsapp`
- Adapters: `Kaarobar.Messaging.Sms.Mock` / `Whatsapp.Mock` (config `:sms_adapter`, `:whatsapp_adapter`)
- Oban workers: `SmsCampaignWorker`, `WhatsappCampaignWorker`

### Customer Portal (TEN-FR-014, CUS-FR-*)

- Tables: `customer_accounts`, `customer_sessions` (separate from staff `users`)
- Business flags: `portal_self_register`, `portal_invite_from_sale`
- Auth: `/api/v1/portal/auth/*`
- Self-service (Bearer session + `x-business-id`): `/api/v1/portal/me`, `/orders`, `/loyalty`, `/ar`, `/bookings` (disabled stub)
- Isolation: plug sets `SET LOCAL app.customer_id`
- Staff invite: `POST /api/v1/customers/:id/portal-invite`

**Deferred:** CUS-FR-005 appointment self-booking (needs Phase B SCH).

## Web clients

- Staff marketing UI: `/app/marketing` (campaigns, segments, coupons, tiers)
- POS coupon field: web + desktop checkout
- Customer Portal UI: `/portal/*` (no staff chrome)
- Role home widgets: `/app` dashboard (TEN-FR-013)

## Config

```elixir
config :kaarobar,
  sms_adapter: Kaarobar.Messaging.Sms.Mock,
  whatsapp_adapter: Kaarobar.Messaging.Whatsapp.Mock
```
