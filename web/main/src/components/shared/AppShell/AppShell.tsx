"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

import { BusinessSwitcher } from "./BusinessSwitcher";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-pos md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            K
          </div>
          {!collapsed && <span className="font-semibold text-sidebar-foreground">Kaarobar</span>}
        </div>
        <div className="border-b border-sidebar-border p-3">
          <BusinessSwitcher collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-3">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-sidebar">
            <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                K
              </div>
              <span className="font-semibold text-sidebar-foreground">Kaarobar</span>
            </div>
            <div className="border-b border-sidebar-border p-3">
              <BusinessSwitcher collapsed={false} />
            </div>
            <SidebarNav collapsed={false} />
            <div className="border-t border-sidebar-border p-3">
              <UserMenu collapsed={false} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
