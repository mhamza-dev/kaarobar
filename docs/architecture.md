# Architecture overview

Aligned to Kaarobar SRS KRB-SRS-001 §3 (ISO/IEC/IEEE 42010 viewpoints), with stack overrides recorded in Document Control decisions for this repo: **PostgreSQL** instead of MongoDB, **Elixir/Phoenix** instead of NestJS.

## Logical / deployment view

```
┌─────────────────────────────────────────────────────────────┐
│ Client layer                                                │
│  Web (Next.js) · Desktop Electron POS · React Native mobile │
└────────────────────────────┬────────────────────────────────┘
                             │ TLS / REST /api/v1
┌────────────────────────────▼────────────────────────────────┐
│ Edge (planned): load balancer, rate limit, WAF              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│ Application — Kaarobar Phoenix modular monolith             │
│  Auth & RBAC · Tenancy · POS · Inventory · Accounting       │
│  HR & Payroll · Reporting · Billing · FBR · Notifications │
│  Oban workers (sale journal, payroll journal, FBR, notify)  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
        PostgreSQL                      Object storage (R2)
        (shared DB,                     receipts / exports
         tenant by ID)
```

## Module dependency rules (SRS Figure 3.2)

- **Auth & Tenancy** are foundational; nothing depends upward into them incorrectly.
- **POS** and **Inventory** post into **Accounting** asynchronously (Oban) so checkout is not blocked by ledger latency.
- **HR** posts payroll journals into **Accounting** after approval.
- **Reporting** is read-only against other modules.

## Multi-tenancy field convention (SRS §6.4)

| Field | When present |
|-------|----------------|
| `owner_id` | Always on tenant-scoped data |
| `business_id` | Everything below Business |
| `branch_id` | Branch-specific entities (Sale, InventoryRecord, Attendance); null for business-wide (COA, Product catalog) |

## Relational mapping (vs SRS Mongo embedding)

| SRS document pattern | PostgreSQL |
|----------------------|------------|
| Sale + embedded items/payments | `sales` + `sale_items` + `sale_payments` in one transaction |
| JournalEntry + lines | `journal_entries` + `journal_lines`; balance enforced in app |
| Product branchPricing[] | `product_branch_prices` |
| inventory `$inc` | Atomic `UPDATE quantity_on_hand = quantity_on_hand - n` |
| Offline `clientTxnId` | `client_txn_id` UUID unique on `sales` |

## Client responsibilities (SRS §2.3 / §8.1)

| Client | Primary actors | Role |
|--------|----------------|------|
| Web | Owner, Manager, Accountant, Inventory, HR | Marketing + full dashboard + browser POS |
| Desktop | Cashier, Branch Manager | Offline-first till, ESC/POS peripherals |
| Mobile | Owner, Manager, Employee | Oversight, approvals, ESS (clock / leave / payslip) |

## Integration points (SRS §3.4 / §8.3)

- FBR POS adapter (async, never blocks sale)
- Payment gateway adapter (customer → owner; tokenized; no raw PAN)
- LemonSqueezy (owner → Kaarobar subscription)
- Notifications: email first; SMS / WhatsApp later
