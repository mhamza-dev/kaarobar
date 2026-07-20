# ADR 001: PostgreSQL shared-database multi-tenancy

## Status

Accepted

## Context

The SRS originally specified MongoDB Atlas with `ownerId` / `businessId` / `branchId` scoping (KRB-SRS-001 §3.2.2). Product direction for this repository uses **PostgreSQL** while keeping the same shared-database, application-enforced tenant-isolation model (not database-per-owner), prioritizing cost efficiency at initial scale (goal G5).

## Decision

- Use a single PostgreSQL database for all tenants.
- Every tenant-scoped table includes `owner_id` (UUID) and, where applicable, `business_id` and/or `branch_id`.
- Compound indexes begin with tenant-scoping columns.
- Enforce scoping in Ecto queries and a Plug pipeline; add Postgres RLS later as defense-in-depth.
- CI tests assert cross-tenant queries return zero rows (SEC-NFR-001).

## Consequences

- A scoping bug can leak data across tenants (mitigated by tests + review checklist).
- Relational integrity (FKs, transactions) strengthens financial posting (sales + stock + journals).
- Sharding by `owner_id` remains a future scaling path.
