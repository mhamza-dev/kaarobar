# Appointments & scheduling (SCH-FR)

Status of the appointments module relative to KRB-SRS-004.

## Authority

- SRS: [`docs/srs/KRB-SRS-004.md`](srs/KRB-SRS-004.md) §5.4 (`SCH-FR-001`–`006`) and `CUS-FR-005`
- Requirement index: [`docs/requirements-index.md`](requirements-index.md)

## MoSCoW / phase

SRS marks appointments as **Should / Phase B**. This delivery **promotes** a production-usable backend for service verticals (salon first), gated by industry / flag — still Should until Product promotes to Must.

## What shipped (backend)

| ID | Behavior |
|----|----------|
| SCH-FR-001 | Book appointment (service product + staff + slot); staff API + customer portal self-book |
| SCH-FR-002 | Soft overlap conflict check on staff time range (rejects conflicting Booked/CheckedIn/InProgress) |
| SCH-FR-003 | `GET /appointments/schedule` — staff day schedule |
| SCH-FR-004 | Status transitions Booked → CheckedIn → InProgress → Completed; Cancelled/NoShow from Booked |
| SCH-FR-005 | On Completed, attempts linked POS sale (pre-filled service); failure does not block completion (stub-tolerant) |
| CUS-FR-005 | Portal: list / slots / book / cancel / reschedule |
| SCH-FR-006 | Reminder notifications — **not** implemented (Could) |

## Gate

- Column `businesses.appointments_enabled` (default false)
- Auto-enabled on create when `industry == "salon"`
- `Kaarobar.Appointments.appointments_enabled?/1` also treats `salon` as enabled even if flag lagging
- Marketplace serialize exposes `appointments_enabled` + `commerce_mode` (`appointments` \| `orders`)

## Schema

Table `appointments`: tenant scope (`owner_id`, `business_id`, `branch_id`), `customer_id` (nullable), `product_id` (service/combo), `staff_id` → `employees`, `starts_at`/`ends_at`, `status`, `sale_id`, `booked_by`.

Migration: `20260801000025_create_appointments.exs`

## Staff API (`/api/v1`, `pos` roles)

- `GET /appointments` — list (`status`, `staff_id`, `customer_id`, `branch_id`, `from`, `to`)
- `GET /appointments/slots` — availability (`product_id`, `staff_id`, `date`, `branch_id`)
- `GET /appointments/schedule` — day schedule (`date`, optional `staff_id` else current employee)
- `POST /appointments` — book
- `GET|PATCH /appointments/:id` — show / reschedule or status transition
- `POST /appointments/:id/cancel`
- `POST /appointments/:id/complete` — advance to Completed (+ sale hook)

## Customer portal

- `GET /portal/appointments` (also `/portal/bookings`)
- `GET /portal/appointments/slots`
- `POST /portal/appointments`
- `PATCH /portal/appointments/:id`
- `POST /portal/appointments/:id/cancel`

Marketplace catalog (`GET /marketplace/businesses/:id/catalog`) includes `staff: [{id, name}]` when appointments are enabled so customers can pick optional staff before loading slots.

## Seeds

Salon businesses for `owner@kaarobar.local` get `appointments_enabled: true` and sample Booked/CheckedIn rows across the next few days.

## Not in this pass

- Exclusion constraint / `btree_gist` (app-level conflict only)
- Reminder jobs (SCH-FR-006)
- Client calendar UI (separate delivery)
- Non-salon service industries beyond the flag (workshop etc. can set `appointments_enabled`)
