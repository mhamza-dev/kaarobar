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
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group, index) => (
        <div key={group.label || index} className="flex flex-col gap-1">
          {group.label && !collapsed && (
            <p className="px-2.5 pb-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
