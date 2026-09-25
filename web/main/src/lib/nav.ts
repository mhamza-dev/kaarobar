import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Boxes,
  CalendarDays,
  ChefHat,
  ClipboardPen,
  CreditCard,
  FileSignature,
  KeyRound,
  Landmark,
  ListOrdered,
  Building2,
  ClipboardList,
  FileText,
  Gift,
  HandCoins,
  Layers,
  LayoutDashboard,
  Package,
  Receipt as ReceiptIcon,
  ScanLine,
  Wallet,
  PackageCheck,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Truck,
  Undo2,
  UtensilsCrossed,
  WalletCards,
  UserRound,
  UsersRound,
  Users,
} from "lucide-react";
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
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        anyPermission: ["report:sales"],
      },
    ],
  },
  {
    label: "Sell",
    items: [
      { label: "Till", href: "/pos", icon: ScanLine, anyPermission: ["sales:checkout"] },
      {
        label: "Sales",
        href: "/sales",
        icon: ReceiptIcon,
        anyPermission: ["sale:view", "sale:view_all"],
      },
      {
        label: "Refunds",
        href: "/refund-requests",
        icon: Undo2,
        anyPermission: ["sale:refund_approve"],
      },
      {
        label: "Card payments",
        href: "/payments",
        icon: CreditCard,
        anyPermission: ["payment:view"],
      },
      {
        label: "Shifts",
        href: "/shifts",
        icon: Wallet,
        anyPermission: ["shift:view", "shift:view_all", "register:view"],
      },
    ],
  },
  {
    // Vertical modules. Each item is gated on the module the business runs
    // (`requiresModule`) as well as the permission — a grocery never sees a
    // kitchen board, whatever its owner's role allows.
    label: "Operations",
    items: [
      {
        label: "Floor",
        href: "/dining",
        icon: UtensilsCrossed,
        anyPermission: ["table:view"],
        requiresModule: "tables",
      },
      {
        label: "Kitchen",
        href: "/kitchen",
        icon: ChefHat,
        anyPermission: ["kitchen:view"],
        requiresModule: "kitchen",
      },
      {
        label: "Diary",
        href: "/appointments",
        icon: CalendarDays,
        anyPermission: ["appointment:view"],
        requiresModule: "appointments",
      },
      {
        label: "Queue",
        href: "/queue",
        icon: ListOrdered,
        anyPermission: ["queue:view"],
        requiresModule: "queue",
      },
      {
        label: "Jobs",
        href: "/service-jobs",
        icon: ClipboardPen,
        anyPermission: ["service_job:view"],
        requiresModule: "service_jobs",
      },
      {
        label: "Hires",
        href: "/rentals",
        icon: KeyRound,
        anyPermission: ["rental:view"],
        requiresModule: "rentals",
      },
      {
        label: "Quotes",
        href: "/quotes",
        icon: FileSignature,
        anyPermission: ["quote:view"],
        requiresModule: "quotes",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: UserRound,
        anyPermission: ["customer:view"],
      },
      {
        label: "Groups",
        href: "/customers/groups",
        icon: UsersRound,
        anyPermission: ["customer_group:view"],
      },
      {
        label: "Follow-ups",
        href: "/follow-ups",
        icon: BellRing,
        anyPermission: ["follow_up:view"],
      },
      {
        label: "Receivables",
        href: "/receivables",
        icon: HandCoins,
        anyPermission: ["credit:view"],
        requiresModule: "credit",
      },
    ],
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
    label: "Inventory",
    items: [
      { label: "Stock", href: "/stock", icon: Boxes, anyPermission: ["inventory:view"] },
      {
        label: "Batches",
        href: "/batches",
        icon: Layers,
        anyPermission: ["batch:manage", "inventory:view"],
        requiresModule: "batches",
      },
      {
        label: "Transfers",
        href: "/stock-transfers",
        icon: ArrowLeftRight,
        anyPermission: ["stock:transfer", "stock:transfer_approve", "stock:receive"],
      },
      {
        label: "Stock counts",
        href: "/stock-counts",
        icon: ClipboardList,
        anyPermission: ["stock:count", "stock:count_approve"],
      },
    ],
  },
  {
    label: "Purchasing",
    items: [
      {
        label: "Suppliers",
        href: "/suppliers",
        icon: Truck,
        anyPermission: ["supplier:view"],
        requiresModule: "suppliers",
      },
      {
        label: "Purchase orders",
        href: "/purchase-orders",
        icon: FileText,
        anyPermission: ["purchase_order:view"],
        requiresModule: "purchasing",
      },
      {
        label: "Goods receipts",
        href: "/goods-receipts",
        icon: PackageCheck,
        anyPermission: ["purchase_order:receive", "purchase_order:view"],
        requiresModule: "purchasing",
      },
      {
        label: "Supplier bills",
        href: "/supplier-bills",
        icon: Receipt,
        anyPermission: ["supplier_bill:manage"],
        requiresModule: "purchasing",
      },
      {
        label: "Purchase returns",
        href: "/purchase-returns",
        icon: Undo2,
        anyPermission: ["purchase_return:manage"],
        requiresModule: "purchasing",
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
        label: "Invitations",
        href: "/settings/staff/invitations",
        icon: Users,
        anyPermission: ["staff:view", "staff:invite"],
      },
      {
        label: "Roles",
        href: "/settings/roles",
        icon: ShieldCheck,
        anyPermission: ["role:view"],
      },
      {
        label: "Businesses",
        href: "/settings/businesses",
        icon: Store,
        anyPermission: ["business:view"],
      },
      {
        label: "Branches",
        href: "/settings/branches",
        icon: Building2,
        anyPermission: ["branch:view"],
      },
      {
        label: "Loyalty",
        href: "/settings/loyalty",
        icon: Gift,
        anyPermission: ["loyalty:manage", "loyalty:view"],
        requiresModule: "loyalty",
      },
      {
        label: "Payment providers",
        href: "/settings/payments",
        icon: WalletCards,
        anyPermission: ["payment:configure"],
      },
      {
        label: "Fiscal reporting",
        href: "/settings/fiscal",
        icon: Landmark,
        anyPermission: ["fiscal:view", "fiscal:configure"],
      },
      {
        label: "Subscription",
        href: "/settings/billing",
        icon: CreditCard,
        anyPermission: ["organization:billing"],
      },
      {
        label: "Organization",
        href: "/settings/organization",
        icon: Settings,
        anyPermission: ["organization:view"],
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
