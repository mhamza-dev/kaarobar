/**
 * Mirrors backend/lib/backend_web/serializers.ex (`membership/1`,
 * `invitation/1`, `role/1`, `role_summary/1`, `grant/1`) — hand-written,
 * kept in sync by hand, since there is no OpenAPI spec.
 */

import type { User } from "./tenancy";

/** The trimmed business shape nested inside memberships and invitations. */
export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  currency: string;
};

export type RoleSummary = {
  id: string;
  key: string;
  name: string;
  rank: number;
  is_system: boolean;
  organization_id: string | null;
};

export type Role = RoleSummary & {
  description: string | null;
  permissions: string[];
  inserted_at: string;
};

/** A direct allow/deny on one key, overriding what the roles resolved to. */
export type PermissionGrant = {
  permission_key: string;
  effect: "allow" | "deny";
  reason: string | null;
  expires_at: string | null;
  granted_by_id: string | null;
};

/**
 * A staff member. The backend calls this a *membership* — a user's link to
 * one organization — and the UI calls it staff; same record.
 *
 * `branch_ids` empty means every branch of the business, not none
 * (`Staffing.assign_branches/3`). `has_pin` is a boolean by design: the
 * register needs to know who can be switched to, never the PIN itself.
 */
export type StaffMember = {
  id: string;
  organization_id: string;
  business_id: string | null;
  employee_code: string | null;
  job_title: string | null;
  status: "active" | "suspended" | "ended" | string;
  started_on: string | null;
  ended_on: string | null;
  has_pin: boolean;
  organization_wide: boolean;
  user: User | null;
  business: BusinessSummary | null;
  roles: RoleSummary[];
  branch_ids: string[];
  inserted_at: string;
  /** Only present on `GET /staff/:id` and after a write — never on the list. */
  permission_grants?: PermissionGrant[];
};

export type Invitation = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: "pending" | "accepted" | "revoked" | "expired" | string;
  message: string | null;
  branch_ids: string[];
  expires_at: string | null;
  accepted_at: string | null;
  role: RoleSummary | null;
  business: BusinessSummary | null;
  invited_by: User | null;
  inserted_at: string;
};

/** `GET /invitations/:token` — the unauthenticated pre-accept summary. */
export type InvitationPreview = {
  email: string;
  name: string | null;
  organization_name: string;
  business_name: string | null;
  role_name: string;
  expires_at: string | null;
  /** True when no account exists yet, so the accept form must collect a password. */
  requires_account: boolean;
};

/** `GET /roles/permissions` — the ~140-key catalogue, pre-grouped by the backend. */
export type PermissionCatalogue = {
  groups: Record<string, Array<{ key: string; label: string }>>;
  /** Group names in the order they should be rendered. */
  order: string[];
};

export type InvitePayload = {
  email: string;
  name?: string;
  phone?: string;
  role_id: string;
  business_id?: string;
  branch_ids?: string[];
  message?: string;
};

export type RolePayload = {
  name: string;
  key?: string;
  description?: string | null;
  rank?: number;
  permissions: string[];
};
