"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

import { BusinessSwitcher } from "./BusinessSwitcher";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const pathname = usePathname();
  // The drawer remembers which page it was opened on and counts as open
  // only while that page is current — so tapping a link in it closes it
  // on arrival, without an effect chasing the route.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const setMobileOpen = (open: boolean) => setOpenedOn(open ? pathname : null);

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

      {/* Mobile drawer — a real modal dialog: focus moves in and is trapped,
          Escape and the backdrop close it, focus returns to the menu
          button, and assistive tech hears "Menu, dialog". */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 md:hidden" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col bg-sidebar outline-none md:hidden">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
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
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
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
