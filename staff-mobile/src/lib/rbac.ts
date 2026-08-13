import { type Session } from "@/lib/api";

/** Bundles owners must never auto-inherit (staff self-service only). */
const OWNER_EXCLUDED_BUNDLES = new Set(["employee_self"]);

const BUNDLES: Record<string, readonly string[]> = {
  owner_manage: ["owner"],
  pos: ["owner", "admin", "branch_manager", "cashier", "employee"],
  pos_approve: ["owner", "admin"],
  inventory: ["owner", "admin", "branch_manager", "inventory_manager", "employee"],
  accounting: ["owner", "admin", "accountant"],
  customers: ["owner", "admin", "accountant", "branch_manager", "cashier", "employee", "marketing"],
  hr: ["owner", "admin", "hr_manager", "branch_manager"],
  leave_approve: ["owner", "admin", "hr_manager"],
  payroll_approve: ["owner", "admin", "accountant"],
  reports: ["owner", "admin", "branch_manager", "accountant"],
  marketing: ["owner", "admin", "hr_manager", "marketing"],
  settings: ["owner"],
  employee_self: ["admin", "employee", "cashier"],
  any_staff: [
    "owner",
    "admin",
    "branch_manager",
    "cashier",
    "inventory_manager",
    "accountant",
    "hr_manager",
    "marketing",
    "employee",
  ],
} as const;

type Bundle = keyof typeof BUNDLES;

const ROUTES: Record<string, Bundle> = {
  "/app/dashboard": "any_staff",
  "/app/pos": "pos",
  "/app/sales": "pos",
  "/app/returns": "pos",
  "/app/customers": "customers",
  "/app/marketing": "marketing",
  "/app/inventory": "inventory",
  "/app/products": "inventory",
  "/app/ess": "employee_self",
  "/app/profile": "any_staff",
  "/app/settings": "any_staff",
  "/app/businesses": "owner_manage",
  "/app/leave": "leave_approve",
};

export function activeRoles(session: Session | null): string[] {
  if (!session?.business_id) return [];
  const roles = (session.memberships || [])
    .filter((m) => m.business_id === session.business_id && m.status === "active")
    .filter((m) => !m.branch_id || !session.branch_id || m.branch_id === session.branch_id)
    .flatMap((m) => m.roles || []);
  return Array.from(new Set(roles));
}

export function isOwner(session: Session | null): boolean {
  return activeRoles(session).includes("owner");
}

/** Plan entitlement check (ADM-FR-002). Missing list → allow until hydrated. */
export function planAllowsBundle(
  entitledBundles: string[] | undefined | null,
  bundle: string
): boolean {
  if (!entitledBundles) return true;
  return entitledBundles.includes(bundle);
}

export function planAllowsFbr(session: Session | null): boolean {
  if (!session) return false;
  if (typeof session.allows_fbr === "boolean") return session.allows_fbr;
  const plan = session.subscription_plan;
  return plan === "growth" || plan === "enterprise";
}

export function roleAllows(session: Session | null, bundle: Bundle): boolean {
  const roles = activeRoles(session);
  if (roles.includes("owner")) {
    if (OWNER_EXCLUDED_BUNDLES.has(bundle)) return false;
    return true;
  }
  return roles.some((r) => (BUNDLES[bundle] || []).includes(r));
}

/** Role ∧ plan entitlement (ADM-FR-002). */
export function canAccess(session: Session | null, bundle: Bundle): boolean {
  if (!roleAllows(session, bundle)) return false;
  return planAllowsBundle(session?.entitled_bundles, bundle);
}

export function canAccessRoute(session: Session | null, route: string): boolean {
  if (!session) return false;

  // Business app — no consumer routes.
  if (session.actor === "consumer") return false;

  if (route.startsWith("/app/market")) {
    return false;
  }

  if (route.startsWith("/app/businesses")) {
    return canAccess(session, "owner_manage");
  }

  const bundle = ROUTES[route];
  if (!bundle) return true;
  return canAccess(session, bundle);
}

export function isPlanFeatureLocked(session: Session | null, route: string): boolean {
  if (!session || session.actor === "consumer") return false;
  const bundle = ROUTES[route];
  if (!bundle) return false;
  return roleAllows(session, bundle) && !planAllowsBundle(session.entitled_bundles, bundle);
}
