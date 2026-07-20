# POS & inventory stock core

Status against KRB-SRS-001 Must items (POS-FR + INV stock core):

| ID | Status | Notes |
|----|--------|-------|
| POS-FR-001 | Done | Cart / line items with server-side branch pricing |
| POS-FR-002 | Done | Tax from product `tax_rate`; cart totals |
| POS-FR-003 | Done | Split tender (`cash` / `card` / `wallet`); sum must match total |
| POS-FR-004 | Done | Atomic stock decrement (`UPDATE … WHERE qty >= n`) |
| POS-FR-005 | Done | Per-branch sequential `INV-######` via `invoice_sequences` |
| POS-FR-006 | Done | Sale list/show APIs; invoice on create response |
| POS-FR-007 | Done | Returns with qty caps + return window (`return_window_days`) |
| POS-FR-008 | Done | Auto-approve vs pending via `refund_auto_approve_limit` |
| POS-FR-009 | Done | Discount capped by `discount_auto_approve_limit` |
| POS-FR-010 | Done | Till open/close with expected cash + `over_short` |
| POS-FR-011 | Done | Required `client_txn_id` UUID; idempotent create |
| INV-FR-001 | Done | Product catalog (existing) + branch prices API |
| INV-FR-002 | Done | `GET /inventory` on-hand listing |
| INV-FR-003 | Done | Stock transfers create + confirm with stock check |
| INV-FR-004 | Done | Purchase orders |
| INV-FR-005 | Done | GRN receive + avg cost; enqueue purchase journal |
| INV-FR-006 | Done | Adjustments with reason allowlist + audit |
| INV-FR-009 | Done | Supplier list/create |

## API surface (additions)

**POS** (`:pos` roles)

- `GET /sales`, `GET /sales/:id`, `POST /sales`
- `GET /tills/current`, `POST /tills/open`, `POST /tills/:id/close`
- `POST /returns`, `POST /returns/:id/approve` (`:pos_approve`)

**Inventory** (`:inventory` roles)

- `GET /inventory`, `POST /inventory/prices`
- `POST /inventory/adjust`, transfers, PO, GRN
- `GET|POST /suppliers`

## Web

`/app/pos` — qty ± / remove, till open/close, split pay, shows invoice number.

## Tests

`mix test test/kaarobar/pos_test.exs`
