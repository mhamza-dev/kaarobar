import { type Session } from "./api";

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

const ROUTES: Record<string, Bundle> = {
  "/dashboard": "any_staff",
  "/pos": "pos",
  "/returns": "pos",
  "/inventory": "inventory",
  "/ess": "employee_self",
  "/profile": "any_staff",
};

export function activeRoles(session: Session | null): string[] {
  if (!session?.business_id) return [];
  const roles = (session.memberships || [])
    .filter((m) => m.business_id === session.business_id && m.status === "active")
    .filter((m) => !m.branch_id || !session.branch_id || m.branch_id === session.branch_id)
    .flatMap((m) => m.roles || []);
  return Array.from(new Set(roles));
}

export function canAccess(session: Session | null, bundle: Bundle): boolean {
  const roles = activeRoles(session);
  if (roles.includes("owner")) {
    if (OWNER_EXCLUDED_BUNDLES.has(bundle)) return false;
    return true;
  }
  return roles.some((r) => (BUNDLES[bundle] || []).includes(r));
}

export function canAccessRoute(session: Session | null, route: string): boolean {
  const bundle = ROUTES[route];
  if (!bundle) return true;
  return canAccess(session, bundle);
}
