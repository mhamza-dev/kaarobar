# HR & payroll

Status against KRB-SRS-001 HR Must items:

| ID | Status | Notes |
|----|--------|-------|
| HR-FR-001 | Done | Employee master (code, name, position, branch, join date, pay, phone/CNIC/IBAN, status); list/create/update APIs + web UI |
| HR-FR-002 | Done | Clock-in/out from mobile ESS (and POS source flag); attendance list for HR |
| HR-FR-005 | Done | Leave request + approve/reject; `branch_manager` included in `:hr` bundle |
| HR-FR-006 | Done | Gross from basic + allowances × attendance/leave factor + overtime hours |
| HR-FR-008 | Done | Progressive PK tax slabs + EOBI (1% of basic, floor Rs 100) via `PayrollDeductions` |
| HR-FR-009 | Done | Draft → PendingApproval → Approved/Rejected; accountant/owner approve |
| HR-FR-010 | Done | On approve: Oban posts consolidated journal (5100 / cash / 2200 tax / 2210 EOBI); payslips generated; run → Posted |
| HR-FR-011 | Done | `GET /ess/me` + mobile ESS (clock, leave, payslips) |

Deferred Should/Could: HR-FR-003 manual attendance correction, HR-FR-004 leave accrual types, HR-FR-007 commission, HR-FR-012 adjustment runs.

## API surface

**HR roles** (`owner`, `hr_manager`, `branch_manager`)

- `GET|POST /employees`, `GET|PATCH /employees/:id`
- `GET /attendance`
- `GET /leave`, `POST /leave/:id/approve|reject`
- `GET|POST /payroll`, `GET /payroll/:id`, `POST /payroll/:id/submit|reject`

**Payroll approve** (`owner`, `accountant`)

- `POST /payroll/:id/approve`

**Employee self**

- `GET /ess/me`
- `POST /attendance/clock-in`, `POST /attendance/:id/clock-out`
- `POST /leave`

## Clients

- Web `/app/hr` — employees, attendance, leave queue, payroll draft/submit/approve
- Mobile `/ess` — clock, leave request, payslip history (requires employee `user_id` link; seed links cashier on first employee)

## Tests

```bash
mix test test/kaarobar/hr_payroll_test.exs
```
