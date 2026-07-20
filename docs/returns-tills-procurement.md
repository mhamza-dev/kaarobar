# Returns, tills & inventory procurement

Hardens POS-FR-007/008/010 and INV procurement Must items.

| ID | Status | Notes |
|----|--------|-------|
| POS-FR-007 | Done | Returns with window, qty caps, refund method, till link for cash |
| POS-FR-008 | Done | Auto vs pending via `refund_auto_approve_limit`; approve + **reject** |
| POS-FR-010 | Done | Till open/close; history list; cash refunds till-scoped; one-open-till index |
| INV-FR-003 | Done | Transfer list + confirm + audit |
| INV-FR-004 | Done | PO create/list/show/status (`draft\|ordered\|partial\|received\|cancelled`) |
| INV-FR-005 | Done | GRN over-receive guard; PO rollup; purchase journal `source_id` |
| INV-FR-006 | Done | Adjustments list + audited reasons |
| INV-FR-009 | Done | Suppliers list/create |

## Hardening delivered

- Return refund journal (`4100` Sales Returns) via `PostReturnJournalWorker`
- Journal `source_id` / `branch_id` persisted; unique `(source_type, source_id)`
- Atomic stock restore on approve; pending reject does not touch stock
- Till expected cash = opening + cash sales − **cash** refunds on that till
- Audit: `return.*`, `till.*`, `po.*`, `grn.create`, `transfer.confirm`

## API additions

**Returns / tills**

- `GET /returns`, `GET /returns/pending`, `GET /returns/:id`
- `POST /returns/:id/reject`
- `GET /tills`, `GET /tills/:id`

**Procurement**

- `GET /inventory/purchase-orders`, `GET …/:id`, `PATCH …/:id` (status)
- `GET /inventory/grn`, `GET /inventory/transfers`, `GET /inventory/adjustments`

## Web

- `/app/returns` — create return, approve/reject queue, till history
- `/app/inventory` — on-hand, suppliers, PO/GRN, transfers, adjustments

## Tests

```bash
mix test test/kaarobar/returns_tills_procurement_test.exs
```
