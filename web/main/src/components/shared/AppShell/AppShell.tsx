"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, PanelLeftClose, PanelLeftOpen, ScanLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoMark } from "@/components/shared/LogoMark";
import { PageActionsProvider } from "@/components/shared/PageActions";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

import { AccountBanners } from "./AccountBanners";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { CommandMenu } from "./CommandMenu";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/**
 * What the sidebar holds, shared by the desktop rail and the phone drawer:
 * the mark, the business switcher, the nav, and the signed-in user.
 *
 * The switcher stays the first button with text in it — the e2e helpers
 * find it that way at every width.
 */
function SidebarContents({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2.5 px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Kaarobar home"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoMark className="size-8" />
          {!collapsed && (
            <span className="text-[1.05rem] font-semibold tracking-tight text-sidebar-foreground">
              Kaarobar
            </span>
          )}
        </Link>
      </div>
      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <BusinessSwitcher collapsed={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <UserMenu collapsed={collapsed} />
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const pathname = usePathname();
  const { can } = usePermission();
  // The drawer remembers which page it was opened on and counts as open
  // only while that page is current — so tapping a link in it closes it
  // on arrival, without an effect chasing the route.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const setMobileOpen = (open: boolean) => setOpenedOn(open ? pathname : null);

  // The one thing a shop does most, a click away from every screen — except
  // the till itself, where it would only reload what's already open.
  const showNewSale = can("sales:checkout") && !pathname.startsWith("/pos");

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-pos md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <SidebarContents collapsed={collapsed} />
      </aside>

      {/* Mobile drawer — a real modal dialog: focus moves in and is trapped,
          Escape and the backdrop close it, focus returns to the menu
          button, and assistive tech hears "Menu, dialog". */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 md:hidden" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-lift outline-none data-closed:animate-out data-closed:slide-out-to-left data-open:animate-in data-open:slide-in-from-left md:hidden">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <SidebarContents collapsed={false} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur-md md:gap-3 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden text-muted-foreground md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[1.125rem]" />
            ) : (
              <PanelLeftClose className="size-[1.125rem]" />
            )}
          </Button>

          <CommandMenu />

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            {showNewSale && (
              <Button nativeButton={false} render={<Link href="/pos" />}>
                <ScanLine className="size-4" aria-hidden />
                <span className="max-sm:sr-only">New sale</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>
        <AccountBanners />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <PageActionsProvider>
            <div className="mx-auto max-w-7xl">{children}</div>
          </PageActionsProvider>
        </main>
      </div>
    </div>
  );
}
