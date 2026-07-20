# Requirement ID index

Stable identifiers from Kaarobar SRS KRB-SRS-001. Use these in PR descriptions and tests for traceability (SRS §11).

Priority uses MoSCoW: **Must** / Should / Could.

## Functional modules

| Prefix | Module | Section |
|--------|--------|---------|
| TEN-FR | Tenancy, Identity & Access | §5.1 |
| POS-FR | POS & Sales | §5.2 |
| INV-FR | Inventory & Procurement | §5.3 |
| ACC-FR | Accounting & Finance | §5.4 |
| HR-FR | HR & Payroll | §5.5 |
| RPT-FR | Reporting & Analytics | §5.6 |
| ADM-FR | Platform Admin & Subscription Billing | §5.7 |
| NOT-FR | Notifications | §5.8 |
| FBR-FR | FBR POS Integration | §8.3.4 |
| OFF-FR | Offline & Synchronization | §10 |

## Non-functional (ISO/IEC 25010)

| Prefix | Characteristic | Section |
|--------|----------------|---------|
| PERF-NFR | Performance Efficiency | §9.1 |
| COMP-NFR | Compatibility | §9.2 |
| USE-NFR | Usability | §9.3 |
| REL-NFR | Reliability | §9.4 |
| SEC-NFR | Security | §9.5 |
| MNT-NFR | Maintainability | §9.6 |
| PORT-NFR | Portability | §9.7 |
| CMP-NFR | Compliance | §9.8 |

## MVP Must-count (SRS Appendix B)

Approximately **86 Must** requirements across modules + NFRs for a Must-only Release 1.0 cut.

## Key Must examples implemented or scaffolded

| ID | Summary |
|----|---------|
| TEN-FR-001/002 | Multi-business, multi-branch |
| TEN-FR-003/004 | Roles + scoped access |
| TEN-FR-006/008 | Auth + immutable audit log |
| POS-FR-001–011 | Cart, tax, split pay, stock, invoice #, returns, discounts, till, offline IDs |
| INV-FR-001–006/009 | Catalog, stock, transfer, PO, GRN, adjustments |
| ACC-FR-001/003/004/010 | COA, balanced journals, auto-post, immutability |
| HR-FR-001/002/005/006/008–011 | Employees, attendance, leave, payroll calc/approve/post, ESS |
| RPT-FR-001/002 | Owner + branch reports |
| ADM-FR-002/003 | Plan limits + LemonSqueezy |
| FBR-FR-001–004 | Tier-1 flag, async report, receipt fields, non-blocking |
| OFF-FR-001–004/006 | Cache, outbox, idempotent sync, delta stock, FBR queue |
| SEC-NFR-001/002/004/006 | Tenant scope, RBAC at API, Argon2, short-lived tokens |

## Use cases (SRS §4.3)

UC-01 Process Sale · UC-02 Return/Refund · UC-03 Discount · UC-04 Till · UC-05–08 Inventory · UC-09–13 Accounting/Tax · UC-14–18 HR · UC-19–22 Administration
