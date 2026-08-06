# Accounting depth

Status against KRB-SRS-004 ACC Must items:

| ID | Status | Notes |
|----|--------|-------|
| ACC-FR-001 | Done | IFRS-for-SMEs default COA seed (`seed_default_coa/2`) + list/create/update account APIs; classification, normal balance, headers |
| ACC-FR-003 | Done | Balanced journals enforced; unbalanced → `:unbalanced_entry`; header accounts not postable |
| ACC-FR-004 | Done | Auto-post sale / return / GRN / payroll (payroll lines balanced) |
| ACC-FR-005 | Done | Manual journals with account picker lines; locked on post |
| ACC-FR-006 | Done | `GET /reports/general-ledger` with running balance |
| ACC-FR-007 | Done | Trial balance with optional `from`/`to` |
| ACC-FR-008 | Done | Sectioned P&L + Balance sheet (IFRS-SME presentation); optional `branch_id` |
| ACC-FR-009 | Done | Indirect cash flow summary (`GET /reports/cash-flow`) |
| ACC-FR-010 | Done | DB triggers block UPDATE/DELETE on locked journals/lines; reverse API |
| ACC-FR-012 | Done | AR invoices, payments, aging buckets |
| ACC-FR-013 | Done | AP bills (incl. from GRN), payments, aging |
| ACC-FR-015 | Done | `GET /reports/consolidated` owner-wide TB |

Deferred: period lock (011), bank recon (014), PDF/Excel (019), FBR production adapter (017), full disclosure notes.

## Default chart (global IFRS for SMEs)

New businesses get an international SME template (Cash, Bank, AR, Inventory, AP, Equity, Sales, COGS, OpEx…). System posting codes (`1000`, `1010`, `1100`, `1200`, `2000`, `2100`, `4000`, `5000`, …) stay stable for auto-journals. Country-specific statutory accounts (e.g. FBR/EOBI) are not in the default seed — optional jurisdiction packs may attach later. Alias `seed_pakistan_coa/2` remains for back-compat.

## Invoice numbers

POS sales use `KB{ShopInitials}-{BranchCode}-{YYYYMMDD}-{seq}` (branch `code` unique per business). Credit-sale AR invoices prefix the sale invoice with `AR-`.

## API surface

**Accounting roles**

- `GET|POST /accounts`, `PATCH /accounts/:id` (fields include `classification`, `normal_balance`, `is_header`, `parent_account_id`)
- `GET|POST /journals`, `GET /journals/:id`, `POST /journals/:id/reverse`
- `GET|POST /customers`
- `GET|POST /ar/invoices`, `POST /ar/invoices/:id/pay`, `GET /ar/aging`
- `GET|POST /ap/bills`, `POST /ap/bills/:id/pay`, `GET /ap/aging`

**Reports roles**

- `GET /reports/trial-balance?from&to`
- `GET /reports/general-ledger?account_id&from&to`
- `GET /reports/profit-and-loss?from&to&branch_id` — includes `sections` (revenue, cost of sales, gross profit, …)
- `GET /reports/balance-sheet?as_of&branch_id` — includes current / non-current sections
- `GET /reports/cash-flow?from&to&branch_id` — indirect method
- `GET /reports/consolidated`

## Web / Desktop

Accounting workspace — COA (create + edit), journals (+ reverse), TB / P&L / BS / Cash flow / GL, AR & AP aging.

## Tests

```bash
mix test test/kaarobar/accounting_test.exs test/kaarobar/pos_test.exs
```
