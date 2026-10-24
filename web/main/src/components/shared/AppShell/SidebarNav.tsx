"use client";

import { ChevronDown, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVisibleNavGroups, type NavGroup, type NavItem } from "@/lib/nav";
import { SETTINGS_GROUP, SETTINGS_HOME } from "@/lib/settingsNav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

const SETTINGS_ITEM: NavItem = { label: "Settings", href: SETTINGS_HOME, icon: Settings };

/**
 * The sidebar's groups, with the settings screens folded into one entry —
 * the settings area has its own menu (app/(app)/settings/layout.tsx).
 */
function sidebarGroups(groups: NavGroup[]): NavGroup[] {
  return groups.map((group) =>
    group.label === SETTINGS_GROUP ? { label: "", items: [SETTINGS_ITEM] } : group,
  );
}

function matches(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one item the current screen belongs to: the longest href it sits
 * under. Without that, /products/categories would light up Products and
 * Categories both.
 */
function activeHref(groups: NavGroup[], pathname: string) {
  return groups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => matches(href, pathname))
    .sort((a, b) => b.length - a.length)[0];
}

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const scope = useSessionStore((state) => state.scope);
  const foldedGroups = useUiStore((state) => state.collapsedNavGroups);
  const toggleNavGroup = useUiStore((state) => state.toggleNavGroup);
  const pathname = usePathname();
  const groups = sidebarGroups(getVisibleNavGroups(scope));
  const current = activeHref(groups, pathname);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "scrollbar-thin flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3",
        collapsed && "px-2",
      )}
    >
      {groups.map((group, index) => {
        const holdsCurrent = group.items.some((item) => item.href === current);
        // A group can be folded shut, but never while it holds the screen
        // you're on — the sidebar always shows where you are.
        const open =
          collapsed || !group.label || holdsCurrent || !foldedGroups.includes(group.label);
        const listId = `nav-group-${index}`;

        return (
          <div key={group.label || index} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div aria-hidden className="mx-auto mb-1 h-px w-6 bg-sidebar-border" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleNavGroup(group.label)}
                  aria-expanded={open}
                  aria-controls={listId}
                  disabled={holdsCurrent}
                  className="group/label flex items-center justify-between rounded-md px-2.5 pb-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:text-muted-foreground"
                >
                  {group.label}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-3.5 transition-transform group-disabled/label:opacity-0",
                      !open && "-rotate-90",
                    )}
                  />
                </button>
              ))}
            {open && (
              <div id={listId} className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={item.href === current}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "group relative flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    collapsed && "justify-center px-0",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs ring-1 ring-sidebar-border/80 dark:shadow-none dark:ring-0"
      : "text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground",
  );
  const icon = (
    <Icon
      aria-hidden
      className={cn(
        "size-[1.0625rem] shrink-0 transition-colors",
        active
          ? "text-sidebar-primary"
          : "text-muted-foreground group-hover:text-sidebar-foreground",
      )}
    />
  );

  // Collapsed to icons, the label moves into a tooltip beside the rail.
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={className}
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={className}>
      {icon}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
