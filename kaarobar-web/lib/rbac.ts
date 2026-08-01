import { type StoredSession } from "@/lib/api/client";

const ROLE_ALIASES: Record<string, string> = {
  admin: "admin",
  manager: "branch_manager",
  inventory_clerk: "inventory_manager",
  hr: "hr_manager",
  marketer: "marketing",
};

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
  notifications: [
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

export type Bundle = keyof typeof BUNDLES;

const ROUTE_BUNDLES: Record<string, Bundle> = {
  "/app": "any_staff",
  "/app/pos": "pos",
  "/app/sales": "pos",
  "/app/appointments": "pos",
  "/app/returns": "pos",
  "/app/customers": "customers",
  "/app/inventory": "inventory",
  "/app/accounting": "accounting",
  "/app/marketing": "marketing",
  "/app/hr": "hr",
  "/app/reports": "reports",
  "/app/notifications": "notifications",
  "/app/ess": "employee_self",
  "/app/profile": "any_staff",
  "/app/settings": "any_staff",
  "/app/businesses": "owner_manage",
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

/** Plan entitlement check (ADM-FR-002). Missing list → allow until hydrated. */
export function planAllowsBundle(
  entitledBundles: string[] | undefined | null,
  bundle: string
): boolean {
  if (!entitledBundles) return true;
  return entitledBundles.includes(bundle);
}

export function planAllowsFbr(session: StoredSession | null): boolean {
  if (!session) return false;
  if (typeof session.allows_fbr === "boolean") return session.allows_fbr;
  const plan = session.subscription_plan;
  return plan === "growth" || plan === "enterprise";
}

export function roleAllowsBundle(
  session: StoredSession | null,
  bundle: Bundle
): boolean {
  const roles = getActiveRoles(session);
  const roleSettings = session?.role_settings || {};

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

/** Role ∧ plan entitlement (ADM-FR-002). */
export function canAccessBundle(
  session: StoredSession | null,
  bundle: Bundle
): boolean {
  if (!roleAllowsBundle(session, bundle)) return false;
  return planAllowsBundle(session?.entitled_bundles, bundle);
}

export function canAccessPath(
  session: StoredSession | null,
  path: string
): boolean {
  if (!session) return false;

  const buyerShared =
    path === "/app" ||
    path === "/app/products" ||
    path.startsWith("/app/products/") ||
    path === "/app/account" ||
    path.startsWith("/app/account/") ||
    path === "/app/sales" ||
    path.startsWith("/app/sales/") ||
    path === "/app/customers" ||
    path.startsWith("/app/customers/") ||
    path === "/app/accounting" ||
    path.startsWith("/app/accounting/") ||
    path === "/app/notifications" ||
    path.startsWith("/app/notifications/") ||
    path.startsWith("/app/market/") ||
    path === "/app/checkout" ||
    path.startsWith("/app/checkout/");

  // Buyer sessions: shared /app routes with buyer views + store pages
  if (session.actor === "consumer") {
    return buyerShared;
  }

  // Staff: all ROUTE_BUNDLES; marketplace storefront & checkout are buyer-only
  if (path.startsWith("/app/market/")) return false;
  if (path === "/app/products" || path.startsWith("/app/products/")) return false;
  if (path === "/app/account" || path.startsWith("/app/account/")) return false;
  if (path === "/app/checkout" || path.startsWith("/app/checkout/")) return false;

  const exact = ROUTE_BUNDLES[path as keyof typeof ROUTE_BUNDLES];
  if (exact) return canAccessBundle(session, exact);
  const prefix = Object.keys(ROUTE_BUNDLES).find(
    (key) => key !== "/app" && path.startsWith(key)
  );
  if (!prefix) return true;
  return canAccessBundle(session, ROUTE_BUNDLES[prefix]);
}

/** True when role allows but plan does not (deep-link toast). */
export function isPlanFeatureLocked(
  session: StoredSession | null,
  path: string
): boolean {
  if (!session || session.actor === "consumer") return false;
  const exact = ROUTE_BUNDLES[path as keyof typeof ROUTE_BUNDLES];
  const bundle =
    exact ||
    (() => {
      const prefix = Object.keys(ROUTE_BUNDLES).find(
        (key) => key !== "/app" && path.startsWith(key)
      );
      return prefix ? ROUTE_BUNDLES[prefix] : null;
    })();
  if (!bundle) return false;
  return (
    roleAllowsBundle(session, bundle) &&
    !planAllowsBundle(session.entitled_bundles, bundle)
  );
}
