import { CircleUserRound } from "lucide-react";

import { getVisibleNavGroups, type NavItem } from "@/lib/nav";
import type { Scope } from "@/types/api/me";

/** The nav group the sidebar folds into a single "Settings" entry. */
export const SETTINGS_GROUP = "Settings";
export const SETTINGS_HOME = "/settings";

export type SettingsItem = NavItem & { description?: string };
export type SettingsSection = { title: string; items: SettingsItem[] };

/**
 * Where each settings screen sits, and a line on what it's for. The screens
 * themselves — and who may see them — still come from `lib/nav.ts`; one
 * this table doesn't know yet lands under "More" rather than going missing.
 */
const PLACEMENT: Record<string, { section: string; description: string }> = {
  "/settings/organization": {
    section: "Organization",
    description: "Name, country, currency and the defaults new businesses start with.",
  },
  "/settings/businesses": {
    section: "Organization",
    description: "Each business, its kind, currency and brand colour.",
  },
  "/settings/branches": {
    section: "Organization",
    description: "The shops and warehouses a business trades from.",
  },
  "/settings/billing": {
    section: "Organization",
    description: "Your Kaarobar plan, how it's paid for, and its invoices.",
  },
  "/settings/staff": {
    section: "People",
    description: "Everyone who works here, and what each of them can do.",
  },
  "/settings/staff/invitations": {
    section: "People",
    description: "Invitations sent and still waiting to be accepted.",
  },
  "/settings/roles": {
    section: "People",
    description: "Bundles of permissions you give to staff.",
  },
  "/settings/taxes": {
    section: "Money",
    description: "Tax rates, tax groups, and whether prices include tax.",
  },
  "/settings/payments": {
    section: "Money",
    description: "Card and wallet gateways the till can charge through.",
  },
  "/settings/bank-accounts": {
    section: "Money",
    description: "Where expenses are paid from, and what's left in each.",
  },
  "/settings/fiscal": {
    section: "Money",
    description: "Reporting every sale to the tax authority.",
  },
  "/settings/loyalty": {
    section: "Customers",
    description: "How customers earn points, and what a point is worth.",
  },
  "/settings/audit-log": {
    section: "Security",
    description: "Who changed what, and when.",
  },
};

const SECTION_ORDER = ["You", "Organization", "People", "Money", "Customers", "Security", "More"];

const PROFILE: SettingsItem = {
  label: "Your profile",
  href: "/settings/profile",
  icon: CircleUserRound,
  description: "Your name, sign-in email, password and signed-in devices.",
};

/** The settings screens this person may open, grouped for the settings area. */
export function getSettingsSections(scope: Scope | null): SettingsSection[] {
  const items =
    getVisibleNavGroups(scope).find((group) => group.label === SETTINGS_GROUP)?.items ?? [];

  const sections = new Map<string, SettingsItem[]>([["You", [PROFILE]]]);
  for (const item of items) {
    const placement = PLACEMENT[item.href];
    const title = placement?.section ?? "More";
    sections.set(title, [
      ...(sections.get(title) ?? []),
      { ...item, description: placement?.description },
    ]);
  }

  return SECTION_ORDER.filter((title) => sections.has(title)).map((title) => ({
    title,
    items: sections.get(title)!,
  }));
}

/** The settings screen a path belongs to: the longest matching href. */
export function activeSettingsHref(sections: SettingsSection[], pathname: string) {
  return sections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
