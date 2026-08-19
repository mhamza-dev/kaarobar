# Architecture overview

Aligned to Kaarobar SRS **[KRB-SRS-004](srs/KRB-SRS-004.md) v4.1** §3 (ISO/IEC/IEEE 42010 viewpoints). This repository’s normative stack: **PostgreSQL** (not MongoDB), **Elixir/Phoenix + Oban** (not NestJS/BullMQ). Multi-market product (Pakistan, UK, Germany, France, …); fiscal e-reporting is pack-based.

## Logical / deployment view

```
┌──────────────────────────────────────────────────────────────────┐
│ Client layer                                                     │
│  Web (Next.js) · Cloud Desktop (Electron sync)                   │
│  Staff mobile · Customer mobile                                  │
│  Offline Desktop Edition (Electron + SQLite; license-then-offline)│
└────────────────────────────┬─────────────────────────────────────┘
                             │ TLS / REST /api/v1  (Cloud clients)
┌────────────────────────────▼─────────────────────────────────────┐
│ Edge (planned): load balancer, rate limit, WAF                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ Application — Kaarobar Phoenix modular monolith (`kaarobar-backend`)  │
│  Auth & RBAC · Tenancy · POS · Inventory · Accounting            │
│  HR & Payroll · Reporting · Billing · Fiscal packs (FBR PK) · Notifications · CRM  │
│  Oban workers (sale journal, payroll journal, fiscal packs, notify)       │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │
               ▼                               ▼
        PostgreSQL                      Object storage (R2)
        (shared DB,                     receipts / exports
         tenant by ID)
```

**Offline Desktop** (`kaarobar-desktop-offline`) does not call Phoenix for day-to-day selling after license activation. See [`offline-desktop.md`](offline-desktop.md) (`ODE-FR-*`).

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

## Relational mapping (vs historical Mongo embedding)

| Historical document pattern | PostgreSQL |
|-----------------------------|------------|
| Sale + embedded items/payments | `sales` + `sale_items` + `sale_payments` in one transaction |
| JournalEntry + lines | `journal_entries` + `journal_lines`; balance enforced in app |
| Product branchPricing[] | `product_branch_prices` |
| inventory `$inc` | Atomic `UPDATE quantity_on_hand = quantity_on_hand - n` |
| Offline `clientTxnId` | `client_txn_id` UUID unique on `sales` |

## Client responsibilities (SRS §2.3 / §8.1)

| Client | Package | Primary actors | Role |
|--------|---------|----------------|------|
| Web | `kaarobar-web` | Owner, Manager, Accountant, Inventory, HR, Buyer | Dashboard + browser POS + buyer market |
| Cloud Desktop | `kaarobar-desktop` | Cashier, Branch Manager | Offline-capable till that syncs (`OFF-FR`) |
| Offline Desktop | `kaarobar-desktop-offline` | Owner, Admin, Manager, Cashier | Single-shop local POS (`ODE-FR`) |
| Staff mobile | `staff-mobile` | Owner, Manager, Employee | Oversight, approvals, ESS |
| Customer mobile | `mobile-consumer` | Consumer | Marketplace / portal |

Cloud clients share TanStack Query defaults — see [`architecture/client-cache-standards.md`](architecture/client-cache-standards.md).

## Integration points (SRS §3.4 / §8.3)

- Jurisdiction fiscal packs — Pakistan **FBR** POS adapter first (async, never blocks sale; opt-in per business); UK/DE/FR packs roadmap (`FUT-FR-023`)
- Payment gateway adapter (customer → owner; tokenized; no raw PAN)
- Safepay (owner → Kaarobar Cloud subscription, Pakistan path; other-market providers Should)
- Offline Desktop license activation (ADM-FR-007; package-local / Supabase during setup)
- Notifications: email first; SMS / WhatsApp later
