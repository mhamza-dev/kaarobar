# Requirement ID index

Stable identifiers from Kaarobar SRS **KRB-SRS-003 v3.1 (Production Baseline)**. Use these in PR descriptions and tests for traceability (SRS §11).

Priority uses MoSCoW: **Must** = production baseline · **Should** = Phase A remaining / Phase B roadmap · **Could** = backlog.

Authoritative SRS: [`docs/srs/KRB-SRS-003.md`](srs/KRB-SRS-003.md) · Archive: [`docs/srs/KRB-SRS-002.md`](srs/KRB-SRS-002.md) (do not use for new work)

## Functional modules

| Prefix | Module | Section | Baseline note |
|--------|--------|---------|---------------|
| TEN-FR | Tenancy, Identity & Access | §5.1 | Must; industry presets; `marketing` role |
| POS-FR | POS & Sales | §5.2 | Must incl. khata + loyalty points; coupons Should |
| INV-FR | Inventory & Procurement | §5.3 | Must; recipes Should |
| SCH-FR | Scheduling & Appointments | §5.4 | **All Should** (Phase B) |
| ACC-FR | Accounting & Finance | §5.5 | Must; FBR production adapter Should |
| HR-FR | HR & Payroll | §5.6 | Must; ESS + employee portal login |
| RPT-FR | Reporting & Analytics | §5.7 | Must core; BI Should |
| ADM-FR | Platform Admin & Billing | §5.8 | Plan limits + LS webhook/checkout Must |
| NOT-FR | Notifications / i18n / brand | §5.9 | In-app, email, push, en/ur, logo Must |
| CRM-FR | CRM & Marketing | §5.10 | Campaigns as-built Must; coupons/tiers/consent Should |
| CUS-FR | Customer Portal | §5.11 | **All Should** (Phase A remaining) |
| SUP-FR | Helpdesk & Support | §5.12 | **All Should** (Phase B) |
| API-FR | Public API & Webhooks | §5.13 | **All Should** (Phase B); inbound LS under ADM |
| FBR-FR | FBR POS Integration | §8.3.4 | Hooks Must; production adapter Should |
| OFF-FR | Offline & Synchronization | §10 | Desktop Must; web/mobile online |

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

## Production baseline Must-count (SRS Appendix A)

Approximately **~85 Must** functional requirements for the honest production baseline (core POS/ACC/HR/CRM-as-built/khata/loyalty). Portal / Helpdesk / Public API / appointments remain Should until Product promotes.

## Key Must examples (shipped or accepted Partial)

| ID | Summary |
|----|---------|
| TEN-FR-001/002/011 | Multi-business, multi-branch, industry presets |
| TEN-FR-003/004/012/015 | Roles (incl. `marketing`), scoped access, ESS user link |
| TEN-FR-006/008 | Auth + immutable audit log |
| POS-FR-001–011 | Cart, tax, split pay, stock, invoice #, returns, discounts, till, offline IDs |
| POS-FR-012/020/021 | Customer attach, **khata**, **loyalty points** |
| INV-FR-001–006/009/011/013 | Catalog, stock, transfer, PO, GRN, variants, FEFO consume |
| ACC-FR-001/003–008/010/012/013/015/017 | COA, journals, statements, AR/AP, FBR hooks |
| HR-FR-001/002/005/006/008–011 | Employees, attendance, leave, payroll, ESS |
| RPT-FR-001/002 | Owner + branch reports |
| ADM-FR-002/003 | Plan limits + LemonSqueezy webhook/checkout |
| CRM-FR-002/007/011/015–017 | Campaigns draft→send, points, async, audiences, customer CRM fields |
| NOT-FR-001/003/004/005/006 | Inbox/email, payslip notify, push, i18n, branding |
| FBR-FR-001–004 | Tier-1 flag, async report, receipt fields, non-blocking |
| OFF-FR-001–004/006 | Desktop cache, outbox, idempotent sync, delta stock, FBR queue |
| SEC-NFR-001/002/004/006 | Tenant scope, RBAC at API, Argon2, short-lived tokens |

## Use cases (SRS §4)

**Core:** UC-01–UC-27 · **CRM/Portal/API (phased):** UC-28–UC-36 · **Baseline additions:** UC-37 Khata · UC-38 Loyalty points

## Goals (SRS §1.4.2)

| ID | Goal |
|----|------|
| G1 | Less hustle for the owner |
| G2 | Real accounting |
| G3 | Branch autonomy (incl. offline desktop POS) |
| G4 | Pakistan-ready (FBR hooks + tax) |
| G5 | Low early operating cost |
| G6 | Customer engagement & retention |
| G7 | Platform extensibility via API (Phase B) |

## Roles (code-aligned)

See [`docs/rbac-roles.md`](rbac-roles.md): `owner`, `admin`, `branch_manager`, `cashier`, `inventory_manager`, `accountant`, `hr_manager`, `marketing`, `employee`. `support_agent` = Phase B.
