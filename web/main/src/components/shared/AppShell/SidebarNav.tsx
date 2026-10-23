"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getVisibleNavGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const scope = useSessionStore((state) => state.scope);
  const pathname = usePathname();
  const groups = getVisibleNavGroups(scope);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "scrollbar-thin flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3",
        collapsed && "px-2",
      )}
    >
      {groups.map((group, index) => (
        <div key={group.label || index} className="flex flex-col gap-0.5">
          {group.label &&
            (collapsed ? (
              <div aria-hidden className="mx-auto mb-1 h-px w-6 bg-sidebar-border" />
            ) : (
              <p className="px-3 pb-1.5 text-[0.688rem] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            ))}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
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
          })}
        </div>
      ))}
    </nav>
  );
}
