# Platform, reporting & integrations

Status against KRB-SRS-001 Must items for reporting, billing, FBR, notifications, and offline sync.

| ID | Status | Notes |
|----|--------|-------|
| RPT-FR-001 | Done | Owner dashboard KPIs (`GET /reports/dashboard`) |
| RPT-FR-002 | Done | Branch dashboard, sales-by-day, low-stock (`/reports/branch`, `/sales-by-day`, `/low-stock`) |
| ADM-FR-002 | Done | Plan limits on business / branch / **user** membership create; usage on `GET /billing/subscription` |
| ADM-FR-003 | Done | LemonSqueezy webhook signature + plan map; checkout URL env |
| FBR-FR-001 | Done | `businesses.fbr_tier1` flag (Settings UI) |
| FBR-FR-002 | Done | Async Oban `:integrations` mock report |
| FBR-FR-003 | Done | `fbr_invoice_no` + `fbr_qr_payload` + `fbr_reported_at` on sale / FBR status |
| FBR-FR-004 | Done | Sale path non-blocking (enqueue only) |
| NOT-FR | Done | Queue + Swoosh email; leave/payroll hooks; `GET /notifications` |
| OFF-FR-001 | Done | Desktop catalog cache (`pos:cache-catalog`) |
| OFF-FR-002 | Done | Desktop JSON sales outbox |
| OFF-FR-003 | Done | `POST /sync/sales` idempotent via `client_txn_id` |
| OFF-FR-004 | Done | `GET /sync/inventory?since=` delta |
| OFF-FR-006 | Done | FBR still async after online/sync sale |

Deferred: real FBR production adapter, SMS/WhatsApp, full LemonSqueezy portal, Urdu i18n.

## API surface

**Billing**

- `GET /billing/subscription` — plan, usage, limits, checkout URL
- `POST /billing/webhook` — LemonSqueezy (HMAC when `LEMONSQUEEZY_WEBHOOK_SECRET` set)

**Reports**

- `GET /reports/dashboard`, `/reports/branch`, `/reports/sales-by-day`, `/reports/low-stock`
- Accounting statements unchanged under `/reports/trial-balance` etc.

**FBR / Sync** (POS roles)

- `GET /fbr/sales/:sale_id`
- `GET /sync/catalog`, `GET /sync/inventory`, `POST /sync/sales`

**Notifications**

- `GET /notifications`, `POST /notifications/:id/read`

## Clients

- Web `/app/reports`, `/app/settings`, `/app/notifications`
- Desktop outbox + catalog cache IPC (`kaarobarPos.*`)

## Tests

```bash
mix test test/kaarobar/platform_integrations_test.exs
```
