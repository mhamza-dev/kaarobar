# Kaarobar roles (TEN-FR-003 / TEN-FR-012)

Canonical staff roles in the backend (`Roles` / memberships):

```
owner
admin
branch_manager
cashier
inventory_manager
accountant
hr_manager
marketing
employee
```

## Phase B (not yet in BE)

```
support_agent
```

## Notes

- Prefer these **code** names in SRS, APIs, and UI — not `marketing_manager`.
- Customer Portal identity uses `customer_accounts` (TEN-FR-014) when shipped — never staff roles.
- Employee Self-Service uses staff `users` linked to employee records (TEN-FR-015), distinct from Customer Portal.
