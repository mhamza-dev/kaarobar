import { LayoutDashboard, Package, Settings, Tags, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { canAny } from "@/lib/permissions";
import type { Scope } from "@/types/api/me";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visible if the scope holds ANY of these — omit to show unconditionally. */
  anyPermission?: string[];
  /** Visible only if the current business has this module active (Kaarobar.Verticals). */
  requiresModule?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * The nav model, driven entirely by backend data — never a hardcoded route
 * matrix. Permission gating reads `scope.permissions` (see
 * `src/lib/permissions.ts`, mirrors `Kaarobar.Scope.can?/2`); vertical
 * gating reads `scope.business.modules`, already resolved server-side per
 * business (`Kaarobar.Verticals.active_modules/1` — see
 * `Serializers.business/1`), so there is no separate frontend copy of the
 * vertical→module matrix to keep in sync.
 *
 * New groups/items are added here as later phases add the routes they
 * gate — this file does not grow beyond what actually exists yet.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/products", icon: Package, anyPermission: ["product:view"] },
      {
        label: "Categories",
        href: "/products/categories",
        icon: Tags,
        anyPermission: ["category:manage"],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Staff",
        href: "/settings/staff",
        icon: Users,
        anyPermission: ["staff:view", "role:view"],
      },
      {
        label: "Organization",
        href: "/settings/organization",
        icon: Settings,
        anyPermission: ["organization:view", "business:view", "branch:view"],
      },
    ],
  },
];

function isVisible(item: NavItem, scope: Scope | null): boolean {
  if (item.anyPermission && !canAny(scope, item.anyPermission)) return false;
  if (item.requiresModule && !scope?.business?.modules.includes(item.requiresModule)) return false;
  return true;
}

/** The nav groups (and items within them) the current scope may see, empty groups dropped. */
export function getVisibleNavGroups(scope: Scope | null): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isVisible(item, scope)),
  })).filter((group) => group.items.length > 0);
}
