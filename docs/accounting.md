# Accounting depth

Status against KRB-SRS-001 ACC Must items:

| ID | Status | Notes |
|----|--------|-------|
| ACC-FR-001 | Done | Pakistan COA seed + list/create/update account APIs |
| ACC-FR-003 | Done | Balanced journals enforced; unbalanced → `:unbalanced_entry` |
| ACC-FR-004 | Done | Auto-post sale / return / GRN / payroll (payroll lines balanced) |
| ACC-FR-005 | Done | Manual journals with account picker lines; locked on post |
| ACC-FR-006 | Done | `GET /reports/general-ledger` with running balance |
| ACC-FR-007 | Done | Trial balance with optional `from`/`to` |
| ACC-FR-008 | Done | P&L + Balance sheet with totals; optional `branch_id` |
| ACC-FR-010 | Done | DB triggers block UPDATE/DELETE on locked journals/lines; reverse API |
| ACC-FR-012 | Done | AR invoices, payments, aging buckets |
| ACC-FR-013 | Done | AP bills (incl. from GRN), payments, aging |
| ACC-FR-015 | Done | `GET /reports/consolidated` owner-wide TB |

Deferred: cash flow (009), period lock (011), bank recon (014), PDF/Excel (019), FBR (017).

## API surface

**Accounting roles**

- `GET|POST /accounts`, `PATCH /accounts/:id`
- `GET|POST /journals`, `GET /journals/:id`, `POST /journals/:id/reverse`
- `GET|POST /customers`
- `GET|POST /ar/invoices`, `POST /ar/invoices/:id/pay`, `GET /ar/aging`
- `GET|POST /ap/bills`, `POST /ap/bills/:id/pay`, `GET /ap/aging`

**Reports roles**

- `GET /reports/trial-balance?from&to`
- `GET /reports/general-ledger?account_id&from&to`
- `GET /reports/profit-and-loss?from&to&branch_id`
- `GET /reports/balance-sheet?as_of&branch_id`
- `GET /reports/consolidated`

## Web

`/app/accounting` — COA, journals (+ reverse), TB / P&L / BS / GL, AR & AP aging.

## Tests

```bash
mix test test/kaarobar/accounting_test.exs
```
