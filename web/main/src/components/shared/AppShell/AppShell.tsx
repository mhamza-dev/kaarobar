"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, PanelLeftClose, PanelLeftOpen, ScanLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoMark } from "@/components/shared/LogoMark";
import { PageActionsProvider } from "@/components/shared/PageActions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

import { AccountBanners } from "./AccountBanners";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { CommandMenu } from "./CommandMenu";
import { ShortcutsDialog } from "./ShortcutsDialog";
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
          "flex h-14 shrink-0 items-center gap-2.5 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Kaarobar home"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoMark className="size-7" />
          {!collapsed && (
            <span className="text-[1.02rem] font-semibold tracking-tight text-sidebar-foreground">
              Kaarobar
            </span>
          )}
        </Link>
      </div>
      <div className={cn("px-3 pb-1", collapsed && "px-2")}>
        <BusinessSwitcher collapsed={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className={cn("p-3 pt-2", collapsed && "px-2")}>
        <UserMenu collapsed={collapsed} />
      </div>
    </>
  );
}

/**
 * The frame every signed-in screen sits in. From `md` up the sidebar and a
 * thin margin make a frame, and the screen itself is a raised panel inside
 * it; on a phone the panel is the whole screen and the sidebar is a drawer.
 */
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
  const onTill = pathname.startsWith("/pos");
  const showNewSale = can("sales:checkout") && !onTill;

  return (
    <div className="flex h-dvh overflow-hidden bg-sidebar">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.25rem]" : "w-60",
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

      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas md:rounded-2xl md:shadow-panel dark:md:ring-1 dark:md:ring-white/[0.06]">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-canvas/80 px-3 backdrop-blur-md md:gap-3 md:px-5">
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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="hidden text-muted-foreground md:inline-flex"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  />
                }
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-[1.125rem]" />
                ) : (
                  <PanelLeftClose className="size-[1.125rem]" />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>

            <CommandMenu />

            <div className="ml-auto flex items-center gap-1 md:gap-1.5">
              {showNewSale && (
                <Button nativeButton={false} render={<Link href="/pos" />} className="mr-1">
                  <ScanLine className="size-4" aria-hidden />
                  <span className="max-sm:sr-only">New sale</span>
                </Button>
              )}
              <ShortcutsDialog />
              <ThemeToggle />
            </div>
          </header>
          <AccountBanners />
          <main
            className={cn(
              "flex-1 overflow-y-auto",
              // The till runs edge to edge and scrolls its own columns.
              onTill ? "px-3 py-4 md:px-5 md:py-5" : "px-4 py-6 md:px-8 md:py-8",
            )}
          >
            <PageActionsProvider>
              <div className={cn("mx-auto", onTill ? "max-w-[96rem] lg:h-full" : "max-w-7xl")}>
                {children}
              </div>
            </PageActionsProvider>
          </main>
        </div>
      </div>
    </div>
  );
}
