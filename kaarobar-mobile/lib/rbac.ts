import { type Session } from "./api";

const BUNDLES: Record<string, readonly string[]> = {
  pos: ["owner", "branch_manager", "cashier"],
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
  if (roles.includes("owner")) return true;
  return roles.some((r) => (BUNDLES[bundle] || []).includes(r));
}

export function canAccessRoute(session: Session | null, route: string): boolean {
  const bundle = ROUTES[route];
  if (!bundle) return true;
  return canAccess(session, bundle);
}
