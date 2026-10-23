"use client";

import { ChevronDown, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const scope = useSessionStore((state) => state.scope);
  const foldedGroups = useUiStore((state) => state.collapsedNavGroups);
  const toggleNavGroup = useUiStore((state) => state.toggleNavGroup);
  const pathname = usePathname();
  const groups = sidebarGroups(getVisibleNavGroups(scope));

  return (
    <nav
      aria-label="Main"
      className={cn(
        "scrollbar-thin flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3",
        collapsed && "px-2",
      )}
    >
      {groups.map((group, index) => {
        const holdsCurrent = group.items.some((item) => isActive(item.href, pathname));
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
                  className="group/label flex items-center justify-between rounded-md px-3 pt-1 pb-1.5 text-[0.688rem] font-semibold tracking-wider text-muted-foreground uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:text-muted-foreground"
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
                    active={isActive(item.href, pathname)}
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

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground",
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-sidebar-primary"
        />
      )}
      <Icon
        className={cn(
          "size-[1.125rem] shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-muted-foreground group-hover:text-sidebar-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
