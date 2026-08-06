# Appointments & scheduling (SCH-FR + FUT-FR-081)

Status of the appointments module relative to KRB-SRS-004.

## Authority

- SRS: [`docs/srs/KRB-SRS-004.md`](srs/KRB-SRS-004.md) §5.4 (`SCH-FR-001`–`006`), `CUS-FR-005`, and `FUT-FR-081`
- Requirement index: [`docs/requirements-index.md`](requirements-index.md)

## MoSCoW / phase

SRS marks appointments as **Should / Phase B**. This delivery **promotes** a production-usable backend for service verticals (salon first), gated by industry / flag — still Should until Product promotes to Must.

`FUT-FR-081` (salon / spa resource & room booking) is **Could** in the SRS; Cloud BE + web implement resources, buffers, deposits/no-show fees, and package sessions on top of SCH-FR.

## What shipped (backend)

| ID | Behavior |
|----|----------|
| SCH-FR-001 | Book appointment (service product + staff + slot); staff API + customer portal self-book |
| SCH-FR-002 | Soft overlap conflict check on staff time range (rejects conflicting Booked/CheckedIn/InProgress) |
| SCH-FR-003 | `GET /appointments/schedule` — staff day schedule |
| SCH-FR-004 | Status transitions Booked → CheckedIn → InProgress → Completed; Cancelled/NoShow from Booked |
| SCH-FR-005 | On Completed, attempts linked POS sale (pre-filled service); failure does not block completion (stub-tolerant) |
| CUS-FR-005 | Portal: list / slots / book / cancel / reschedule |
| FUT-FR-081 | Bookable resources (room/chair/equipment), product resource requirements, buffer windows, deposit & no-show fee sales, package session redeem |
| SCH-FR-006 | Reminder notifications — **not** implemented (Could) |

## Gate

- Column `businesses.appointments_enabled` (default false)
- Auto-enabled on create when `industry == "salon"`
- `Kaarobar.Appointments.appointments_enabled?/1` also treats `salon` as enabled even if flag lagging
- Marketplace serialize exposes `appointments_enabled` + `commerce_mode` (`appointments` \| `orders`)

## Schema

Table `appointments`: tenant scope (`owner_id`, `business_id`, `branch_id`), `customer_id` (nullable), `product_id` (service/combo), `staff_id` → `employees`, `starts_at`/`ends_at`, `status`, `sale_id`, `booked_by`, buffer snapshots, deposit fields, optional `package_purchase_id`.

FUT-FR-081 tables: `bookable_resources`, `product_resources`, `appointment_resources`, `service_packages`, `customer_package_purchases`. Products gain `buffer_*`, `deposit_amount`, `no_show_fee_amount`.

Migrations: `20260801000025_create_appointments.exs`, `20260806115100_salon_resource_booking.exs`

## Staff API (`/api/v1`, `pos` roles)

- `GET /appointments` — list (`status`, `staff_id`, `customer_id`, `branch_id`, `from`, `to`)
- `GET /appointments/slots` — availability (`product_id`, `staff_id`, `date`, `branch_id`); respects staff + resource busy windows
- `GET /appointments/schedule` — day schedule (`date`, optional `staff_id` else current employee)
- `POST /appointments` — book (auto-assigns free resource of required kind when not specified)
- `GET|PATCH /appointments/:id` — show / reschedule or status transition
- `POST /appointments/:id/cancel`
- `POST /appointments/:id/complete` — advance to Completed (+ sale hook; applies paid deposit)
- `POST /appointments/:id/no-show` — NoShow (+ optional no-show fee sale; forfeits paid deposit)
- `POST /appointments/:id/deposit/pay` — mark deposit paid via linked sale
- `GET|POST|PATCH|DELETE /bookable-resources` — branch-scoped resource CRUD (DELETE soft-deactivates)

## Customer portal

- `GET /portal/appointments` (also `/portal/bookings`)
- `GET /portal/appointments/slots`
- `POST /portal/appointments` — server auto-assigns resources; returns deposit fields when configured
- `PATCH /portal/appointments/:id`
- `POST /portal/appointments/:id/cancel`

Marketplace catalog (`GET /marketplace/businesses/:id/catalog`) includes `staff: [{id, name}]` when appointments are enabled so customers can pick optional staff before loading slots.

## Seeds

Salon businesses for `owner@kaarobar.local` get `appointments_enabled: true`, sample Booked/CheckedIn rows, demo chairs/rooms/equipment, product resource requirements, buffers/deposit/no-show on sample services, and a 5-session package purchase.

## Web (Cloud)

- `/app/resources` — branch-scoped bookable resource CRUD (Formik + Yup)
- `/app/appointments` — day list with resource names, Book modal, `resource_conflict` toast, deposit pay action
- Product form — buffer before/after, deposit, no-show fee on service/combo products
- Buyer Book flow — deposit note when the service has `deposit_amount`

## Not in this pass

- Exclusion constraint / `btree_gist` (app-level conflict only)
- Reminder jobs (SCH-FR-006)
- Biometric check-in (FUT-FR-030)
- Offline Desktop Edition resource booking
