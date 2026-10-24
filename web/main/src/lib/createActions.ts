import { ClipboardPen, FileSignature, FileText, PackagePlus, ScanLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getVisibleNavGroups } from "@/lib/nav";
import { can } from "@/lib/permissions";
import type { Scope } from "@/types/api/me";

export type CreateAction = { label: string; href: string; icon: LucideIcon; keywords: string[] };

/**
 * "New …" jobs for the command menu. Each one needs the screen it belongs to
 * to be visible — which carries the module gating, so a grocery never sees
 * "New job card" — and the permission the screen's own button checks.
 */
const ACTIONS: Array<CreateAction & { listHref: string; permission: string }> = [
  {
    label: "New sale",
    href: "/pos",
    listHref: "/pos",
    permission: "sales:checkout",
    icon: ScanLine,
    keywords: ["till", "checkout", "ring up", "sell"],
  },
  {
    label: "New product",
    href: "/products/new",
    listHref: "/products",
    permission: "product:create",
    icon: PackagePlus,
    keywords: ["add", "item", "catalog"],
  },
  {
    label: "New purchase order",
    href: "/purchase-orders/new",
    listHref: "/purchase-orders",
    permission: "purchase_order:create",
    icon: FileText,
    keywords: ["order", "supplier", "buy", "po"],
  },
  {
    label: "New quote",
    href: "/quotes/new",
    listHref: "/quotes",
    permission: "quote:manage",
    icon: FileSignature,
    keywords: ["estimate", "proposal"],
  },
  {
    label: "New job card",
    href: "/service-jobs/new",
    listHref: "/service-jobs",
    permission: "service_job:create",
    icon: ClipboardPen,
    keywords: ["repair", "service", "job"],
  },
];

export function createActions(scope: Scope | null): CreateAction[] {
  const visible = new Set(
    getVisibleNavGroups(scope).flatMap((group) => group.items.map((item) => item.href)),
  );
  return ACTIONS.filter(
    (action) => visible.has(action.listHref) && can(scope, action.permission),
  ).map(({ label, href, icon, keywords }) => ({ label, href, icon, keywords }));
}
