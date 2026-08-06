# Platform, reporting & integrations

Status against KRB-SRS-004 Must items for reporting, billing, FBR, notifications, and **Cloud Desktop** offline sync (`OFF-FR`).

Offline Desktop Edition (`ODE-FR`) is a separate package — see [`offline-desktop.md`](offline-desktop.md) / `kaarobar-desktop-offline`. It does not use these sync endpoints for day-to-day selling.

| ID | Status | Notes |
|----|--------|-------|
| RPT-FR-001 | Done | Owner dashboard KPIs (`GET /reports/dashboard`) |
| RPT-FR-002 | Done | Branch dashboard, sales-by-day, low-stock (`/reports/branch`, `/sales-by-day`, `/low-stock`) |
| ADM-FR-002 | Done | Plan limits on business / branch / **user** membership create; usage on `GET /billing/subscription`; `subscription_plans` catalog with `entitled_bundles`; API + UI feature gating (`plan_feature_locked`) |
| ADM-FR-003 | Done | **Safepay** HMAC webhook + hosted checkout (`POST /billing/checkout`); env fallback URL (Pakistan: JazzCash / Easypaisa / cards) |
| ADM-FR-005 | Partial | Expired trial / cancelled / paused / past_due block creates (`subscription_inactive`) |
| FBR-FR-001 | Done | `businesses.fbr_tier1` flag (Settings UI); **Growth+** plan required |
| FBR-FR-002 | Done | Async Oban `:integrations` mock report |
| FBR-FR-003 | Done | `fbr_invoice_no` + `fbr_qr_payload` + `fbr_reported_at` on sale / FBR status |
| FBR-FR-004 | Done | Sale path non-blocking (enqueue only) |
| NOT-FR | Done | Queue + Swoosh email; leave/payroll hooks; `GET /notifications` |
| OFF-FR-001 | Done | Desktop catalog cache (`pos:cache-catalog`) |
| OFF-FR-002 | Done | Desktop JSON sales outbox |
| OFF-FR-003 | Done | `POST /sync/sales` idempotent via `client_txn_id` |
| OFF-FR-004 | Done | `GET /sync/inventory?since=` delta |
| OFF-FR-006 | Done | FBR still async after online/sync sale |

Deferred: real FBR production adapter, full customer billing portal (ADM-FR-004). Lemon Squeezy is **retired** from the live path.

## API surface

**Billing**

- `GET /billing/subscription` — plan, usage, limits, `entitled_bundles`, `allows_fbr`, `plans[]` (name, price_display / price_pkr, tagline, features, **entitled_bundles**, limits, `checkout_available`, `safepay_plan_id`), `allows_writes`, optional fallback checkout URL
- `POST /billing/checkout` — `{ plan, redirect_url? }` → Safepay hosted subscribe URL (reference carries `owner_id` / `plan` / `type=subscription`)
- `POST /billing/webhook` — Safepay (`X-SFPY-SIGNATURE` when `SAFEPAY_WEBHOOK_SECRET` set)

Catalog limits (seeded `subscription_plans`, ADM-FR-002):

| Plan | Price | Businesses | Branches | Users |
|------|-------|------------|----------|-------|
| Trial | Free · 14 days | 1 | 2 | 5 |
| Starter | Rs 4,999/month | 3 | 10 | 25 |
| Growth | Rs 12,999/month | 10 | 50 | 100 |
| Enterprise | Custom | 9999 | 9999 | 9999 |

### Module entitlement matrix (`entitled_bundles`)

Access requires **role ∧ plan** (`Authorize` plug → 403 `plan_feature_locked`). Non-entitled nav modules are **hidden** (not greyed).

| Plan | Bundles |
|------|---------|
| trial | `any_staff`, `pos`, `inventory`, `customers`, `notifications`, `owner_manage`, `settings` |
| starter | trial + `accounting`, `hr`, `reports`, `leave_approve` |
| growth | starter + `marketing`, `payroll_approve`, `pos_approve` (+ FBR via `allows_fbr` / `Billing.plan_allows_fbr?/1`) |
| enterprise | all product bundles including `employee_self` |

Helpers: `Billing.entitled_bundles_for_owner/1`, `Billing.plan_allows_bundle?/2`, `Billing.plan_allows_fbr?/1`.

### Safepay env

| Variable | Purpose |
|----------|---------|
| `SAFEPAY_API_KEY` | Payment init client key |
| `SAFEPAY_SECRET_KEY` | Merchant secret (passport + API) |
| `SAFEPAY_WEBHOOK_SECRET` | HMAC for webhooks |
| `SAFEPAY_ENVIRONMENT` | `sandbox` \| `production` \| `development` |
| `SAFEPAY_PLAN_STARTER` / `_GROWTH` / `_ENTERPRISE` | Plan IDs (preferred over DB) |
| `SAFEPAY_CHECKOUT_URL` | Static fallback when keys unset |

Optional DB column: `subscription_plans.safepay_plan_id`. Create plans in the Safepay dashboard; point webhooks at `/api/v1/billing/webhook`.

Module: `Kaarobar.Billing.Safepay` (hosted redirect checkout — no embedded card fields).

**Reports**

- `GET /reports/dashboard`, `/reports/branch`, `/reports/sales-by-day`, `/reports/low-stock`
- Accounting statements unchanged under `/reports/trial-balance` etc.

**FBR / Sync** (POS roles; FBR enable/enqueue Growth+)

- `GET /fbr/sales/:sale_id`
- `GET /sync/catalog`, `GET /sync/inventory`, `POST /sync/sales`

**Notifications**

- `GET /notifications`, `POST /notifications/:id/read`

## Clients

- Web `/app/reports`, `/app/settings`, `/app/notifications`
- Desktop outbox + catalog cache IPC (`kaarobarPos.*`)
- Web / desktop / mobile: nav + route guards filter with `canAccessBundle ∧ planAllowsBundle`; deep links toast `rbac.planFeatureLocked`

## Tests

```bash
mix test test/kaarobar/platform_integrations_test.exs test/kaarobar/plan_entitlements_test.exs test/kaarobar/campaign_payment_test.exs
```
