# Requirement ID index

Stable identifiers from Kaarobar SRS **KRB-SRS-004 v4.1 (Whole Product Family — Multi-Market)**. Use these in PR descriptions and tests for traceability (SRS §11).

Priority uses MoSCoW: **Must** = production baseline · **Should** = Phase A remaining / Phase B roadmap · **Could** = backlog / §14 upcoming (`FUT-FR`).

Authoritative SRS: [`docs/srs/KRB-SRS-004.md`](srs/KRB-SRS-004.md)

Publisher: **2ndHub Solutions**. Product family: **Kaarobar** — **Cloud** (subscription; packages `kaarobar-web` / `kaarobar-desktop` / mobile) and **Offline Desktop** (one-time; package [`kaarobar-desktop-offline`](../kaarobar-desktop-offline/)). Offline feature doc: [`docs/offline-desktop.md`](offline-desktop.md).

**Geography (v4.1):** Launch markets include **Pakistan, United Kingdom, Germany, France**, and further markets as Product enables. Jurisdiction fiscal e-reporting (Pakistan **FBR** via `FBR-FR-*`) is a pluggable pack — not a Pakistan-only product scope.

## Functional modules

| Prefix | Module | Section | Baseline note |
|--------|--------|---------|---------------|
| TEN-FR | Tenancy, Identity & Access | §5.1 | Must; industry presets; `marketing` role |
| POS-FR | POS & Sales | §5.2 | Must incl. khata + loyalty points; coupons Should |
| INV-FR | Inventory & Procurement | §5.3 | Must; recipes Should |
| SCH-FR | Scheduling & Appointments | §5.4 | **Should** (Phase B); salon backend + Cloud `FUT-FR-081` resources — see [`docs/appointments.md`](appointments.md) |
| ACC-FR | Accounting & Finance | §5.5 | Must; configurable tax per jurisdiction; FBR production adapter Should |
| HR-FR | HR & Payroll | §5.6 | Must; ESS + employee portal login; jurisdiction statutory packs |
| RPT-FR | Reporting & Analytics | §5.7 | Must core; BI Should |
| ADM-FR | Platform Admin & Billing | §5.8 | Plan limits + **Safepay** webhook/checkout Must (PK Cloud path); other-market providers Should; **ADM-FR-007** Offline one-time license Must |
| NOT-FR | Notifications / i18n / brand | §5.9 | In-app, email, push, launch locales (`en`/`ur`/`de`/`fr`/`es`/`pt-BR`/`ar`), logo Must |
| CRM-FR | CRM & Marketing | §5.10 | Campaigns as-built Must; **Phase A:** coupons/tiers/consent/segments/SMS/WA implemented as Should |
| CUS-FR | Customer Portal | §5.11 | **Phase A Should implemented** (booking deferred to Phase B) |
| SUP-FR | Helpdesk & Support | §5.12 | **All Should** (Phase B) |
| API-FR | Public API & Webhooks | §5.13 | **All Should** (Phase B); inbound Safepay under ADM |
| FBR-FR | Pakistan FBR fiscal pack | §8.3.4 | Hooks + pack interface Must; production adapter Should; non-PK packs = §14 |
| OFF-FR | Cloud Desktop Offline & Sync | §10.5 | Cloud Desktop Must; web/mobile online |
| ODE-FR | Offline Desktop Edition | §10.6 | Must — single shop, SQLite, license-then-offline |
| FUT-FR | Possible upcoming features | §14 | Could until Product promotes. **Promoted Must:** Offline `FUT-FR-001/002/004/008`; Cloud `FUT-FR-081`. `FUT-FR-030` remains Could. |

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

Approximately **~100 Must** functional requirements for the honest production baseline (core POS/ACC/HR/CRM-as-built/khata/loyalty + Offline Desktop `ODE-FR`).

**Phase A remaining (Should — implemented in code, not Must until Product promotes):** Customer Portal (`CUS-FR`, booking deferred), coupons, loyalty tiers, consent, named segments, SMS/WhatsApp adapters, role-home polish. See [`docs/crm.md`](crm.md).

Portal / Helpdesk / Public API remain Should until Product promotes. Appointments backend is Should but implemented for salon (`docs/appointments.md`); Helpdesk / Public API are still Phase B.

## Key Must examples (shipped or accepted Partial)

| ID | Summary |
|----|---------|
| TEN-FR-001/002/011 | Multi-business, multi-branch, industry presets |
| TEN-FR-003/004/012/015 | Roles (incl. `marketing`), scoped access, ESS user link |
| TEN-FR-006/008 | Auth + immutable audit log |
| POS-FR-001–011 | Cart, tax, split pay, stock, invoice #, returns, discounts, till, offline IDs |
| POS-FR-012/020/021 | Customer attach, **khata**, **loyalty points** |
| INV-FR-001–006/009/011/013 | Catalog, stock, transfer, PO, GRN, variants, FEFO consume |
| ACC-FR-001/003–008/010/012/013/015/017 | COA, journals, statements, AR/AP, Pakistan FBR pack hooks |
| HR-FR-001/002/005/006/008–011 | Employees, attendance, leave, payroll, ESS |
| RPT-FR-001/002 | Owner + branch reports |
| ADM-FR-002/003 | Plan limits + **Safepay** webhook/checkout (Pakistan Cloud path) |
| ADM-FR-007 | Offline Desktop one-time license: activation, expiry/lifetime, POS lockout |
| CRM-FR-002/007/011/015–017 | Campaigns draft→send, points, async, audiences, customer CRM fields |
| NOT-FR-001/003/004/005/006 | Inbox/email, payslip notify, push, launch-market i18n, branding |
| FBR-FR-001–004/007 | PK Tier-1 flag, async report, receipt fields, non-blocking, fiscal-pack interface |
| OFF-FR-001–004/006 | Cloud Desktop cache, outbox, idempotent sync, delta stock, FBR queue when pack on |
| ODE-FR-001–014 | Single shop, SQLite, license-then-offline, multi-locale RTL, vertical POS, checkout, catalog/PO, khata, RBAC, branding, encrypted backup, lockout/reminders, installers |
| SEC-NFR-001/002/004/006 | Tenant scope, RBAC at API, Argon2, short-lived tokens |

## Use cases (SRS §4)

**Core:** UC-01–UC-27 · **CRM/Portal/API (phased):** UC-28–UC-36 · **Baseline additions:** UC-37 Khata · UC-38 Loyalty points

## Goals (SRS §1.4.2)

| ID | Goal |
|----|------|
| G1 | Less hustle for the owner |
| G2 | Real accounting |
| G3 | Branch autonomy (incl. Cloud desktop sync + Offline Desktop edition) |
| G4 | Jurisdiction-ready tax & fiscal integrations (configurable tax; Pakistan FBR pack first; UK/DE/FR packs roadmap) |
| G5 | Low early operating cost |
| G6 | Customer engagement & retention |
| G7 | Platform extensibility via API (Phase B) |

## Roles (code-aligned)

See [`docs/rbac-roles.md`](rbac-roles.md): `owner`, `admin`, `branch_manager`, `cashier`, `inventory_manager`, `accountant`, `hr_manager`, `marketing`, `employee`. `support_agent` = Phase B.
