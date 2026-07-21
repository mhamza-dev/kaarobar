import { type StoredSession } from "@/lib/api/client";

const ROLE_ALIASES: Record<string, string> = {
  manager: "branch_manager",
  inventory_clerk: "inventory_manager",
  hr: "hr_manager",
};

const BUNDLES: Record<string, readonly string[]> = {
  owner_manage: ["owner"],
  pos: ["owner", "branch_manager", "cashier"],
  pos_approve: ["owner", "branch_manager"],
  inventory: ["owner", "branch_manager", "inventory_manager"],
  accounting: ["owner", "accountant"],
  hr: ["owner", "hr_manager", "branch_manager"],
  reports: ["owner", "branch_manager", "accountant"],
  employee_self: [
    "owner",
    "branch_manager",
    "hr_manager",
    "employee",
    "cashier",
    "inventory_manager",
    "accountant",
  ],
  any_staff: [
    "owner",
    "branch_manager",
    "cashier",
    "inventory_manager",
    "accountant",
    "hr_manager",
    "employee",
  ],
} as const;

type Bundle = keyof typeof BUNDLES;

const ROUTE_BUNDLES: Record<string, Bundle> = {
  "/app": "any_staff",
  "/app/pos": "pos",
  "/app/returns": "pos",
  "/app/inventory": "inventory",
  "/app/accounting": "accounting",
  "/app/hr": "hr",
  "/app/reports": "reports",
  "/app/notifications": "any_staff",
  "/app/profile": "any_staff",
  "/app/settings": "owner_manage",
};

function normalizeRole(role: string): string {
  return ROLE_ALIASES[role] || role;
}

export function getActiveRoles(session: StoredSession | null): string[] {
  if (!session) return [];
  const businessId = session.business_id;
  if (!businessId) return [];
  const branchId = session.branch_id;
  const roles = (session.memberships || [])
    .filter((m) => m.business_id === businessId && m.status === "active")
    .filter((m) => !m.branch_id || !branchId || m.branch_id === branchId)
    .flatMap((m) => m.roles || [])
    .map(normalizeRole);
  return Array.from(new Set(roles));
}

export function canAccessBundle(
  session: StoredSession | null,
  bundle: Bundle
): boolean {
  const roles = getActiveRoles(session);
  if (roles.includes("owner")) return true;
  return roles.some((role) => (BUNDLES[bundle] || []).includes(role));
}

export function canAccessPath(
  session: StoredSession | null,
  path: string
): boolean {
  const exact = ROUTE_BUNDLES[path as keyof typeof ROUTE_BUNDLES];
  if (exact) return canAccessBundle(session, exact);
  const prefix = Object.keys(ROUTE_BUNDLES).find(
    (key) => key !== "/app" && path.startsWith(key)
  );
  if (!prefix) return true;
  return canAccessBundle(session, ROUTE_BUNDLES[prefix]);
}
