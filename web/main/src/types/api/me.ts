import type { Branch, Business, Organization, User } from "./tenancy";

/**
 * `GET /me` — mirrors backend/lib/backend_web/serializers.ex#scope/1 and
 * controllers/me_json.ex#show/1 exactly.
 *
 * `branch_ids` is `null` when the membership isn't restricted to particular
 * branches (covers every branch of its business — owners, admins, most
 * single-branch shops); otherwise it's the explicit allow-list.
 */
export type Scope = {
  user: User | null;
  organization: Organization | null;
  business: Business | null;
  branch: Branch | null;
  is_owner: boolean;
  roles: string[];
  permissions: string[];
  branch_ids: string[] | null;
  organizations: Organization[];
};
