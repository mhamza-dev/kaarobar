import { type StoredSession } from "@/lib/api/client";

const ROLE_ALIASES: Record<string, string> = {
  admin: "admin",
  manager: "branch_manager",
  inventory_clerk: "inventory_manager",
  hr: "hr_manager",
};

/** Bundles owners must never auto-inherit (staff self-service only). */
const OWNER_EXCLUDED_BUNDLES = new Set(["employee_self"]);

const BUNDLES: Record<string, readonly string[]> = {
  owner_manage: ["owner"],
  pos: ["owner", "admin", "branch_manager", "cashier", "employee"],
  pos_approve: ["owner", "admin"],
  inventory: ["owner", "admin", "branch_manager", "inventory_manager", "employee"],
  accounting: ["owner", "admin", "accountant"],
  customers: ["owner", "admin", "accountant", "branch_manager", "cashier", "employee"],
  hr: ["owner", "admin", "hr_manager", "branch_manager"],
  leave_approve: ["owner", "admin", "hr_manager"],
  payroll_approve: ["owner", "admin", "accountant"],
  reports: ["owner", "admin", "branch_manager", "accountant"],
  settings: ["owner"],
  notifications: [
    "owner",
    "admin",
    "branch_manager",
    "cashier",
    "inventory_manager",
    "accountant",
    "hr_manager",
    "employee",
  ],
  // Staff tools — Admin & Employees (incl. cashiers); not owners
  employee_self: ["admin", "employee", "cashier"],
  any_staff: [
    "owner",
    "admin",
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
  "/app/notifications": "notifications",
  "/app/ess": "employee_self",
  "/app/profile": "any_staff",
  "/app/settings": "any_staff",
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
  const roleSettings = session?.role_settings || {};

  // Owners get full access except staff self-service (ESS / Staff tools).
  if (roles.includes("owner")) {
    if (OWNER_EXCLUDED_BUNDLES.has(bundle)) return false;
    return true;
  }

  return roles.some((role) => {
    const override = roleSettings[role]?.[bundle];
    if (typeof override === "boolean") return override;
    return (BUNDLES[bundle] || []).includes(role);
  });
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
