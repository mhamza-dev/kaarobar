# Phase 1 — Tenancy, identity, RBAC (TEN-FR Must)

Status against KRB-SRS-001 Must items:

| ID | Status | Notes |
|----|--------|-------|
| TEN-FR-001 | Done | Create / list / show / update businesses; owner + membership-aware list |
| TEN-FR-002 | Done | Create / list / show / update branches; ownership checks on create |
| TEN-FR-003 | Done | Canonical roles + membership APIs; `Authorize` plug on module routes |
| TEN-FR-004 | Done | Business + branch access in `TenantScope`; owner implicit all |
| TEN-FR-006 | Done | Email/password + TOTP enroll/confirm/login challenge; MFA default for owners |
| TEN-FR-008 | Done | `Audit.log/1` on tenancy/auth mutations; DB trigger blocks update/delete |
| TEN-FR-009 | Done | Soft-deactivate business/branch; inactive tenants denied in TenantScope |

## API surface

- `POST /auth/register`, `POST /auth/login`, `POST /auth/mfa/verify`
- `POST /auth/mfa/setup`, `POST /auth/mfa/confirm`, `GET /auth/me`
- `GET/POST /businesses`, `PATCH /businesses/:id`, `POST /businesses/:id/deactivate`
- Branches under `/businesses/:business_id/branches` (+ patch/deactivate)
- Memberships under `/businesses/:business_id/memberships`
- `GET /audit-logs`

## Roles

See `docs/rbac-roles.md`.
