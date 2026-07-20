"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { appNav, appNavGroups, routes } from "@/lib/navigation";
import { clearSession, getSession, type StoredSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";

const icons = {
  layout: LayoutDashboard,
  pos: ShoppingCart,
  returns: Receipt,
  inventory: Boxes,
  accounting: BookOpen,
  hr: Users,
  reports: ClipboardList,
  bell: Bell,
  settings: Settings,
} as const;

function pageTitle(pathname: string) {
  const hit = appNav.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/app" && pathname.startsWith(item.href))
  );
  return hit?.title ?? "Workspace";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(routes.login);
      return;
    }
    setSessionState(current);
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const grouped = useMemo(
    () =>
      appNavGroups
        .map((group) => ({
          group,
          items: appNav.filter((item) => item.group === group),
        }))
        .filter((g) => g.items.length > 0),
    []
  );

  const title = pageTitle(pathname);
  const isPos = pathname.startsWith("/app/pos");

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-body">
        Loading workspace…
      </div>
    );
  }

  const initials = session.user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function NavBody({ compact = false }: { compact?: boolean }) {
    return (
      <nav className={`flex flex-1 flex-col gap-5 ${compact ? "px-3 py-4" : "px-3 py-5"}`}>
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-rail-muted">
              {group}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/app" && pathname.startsWith(item.href));
                const Icon = icons[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand text-white shadow-sm"
                        : "text-rail-foreground hover:bg-rail-hover"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-rail-muted"}`}
                      strokeWidth={2}
                    />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary text-heading">
      {/* Desktop rail */}
      <aside className="relative z-30 hidden w-[248px] shrink-0 flex-col border-r border-rail-border bg-rail lg:flex">
        <div className="flex items-center gap-3 border-b border-rail-border px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-brand">
            K
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-heading">Kaarobar</p>
            <p className="text-xs text-rail-muted">Point of Sale</p>
          </div>
        </div>
        <NavBody />
        <div className="mt-auto border-t border-rail-border p-4">
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push(routes.login);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rail-muted transition hover:bg-rail-hover hover:text-heading"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-14 items-center justify-between gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-white/10"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="lg:hidden">
              <span className="text-sm font-bold text-white">Kaarobar</span>
            </div>
            <h1 className="hidden text-xs font-bold uppercase tracking-[0.18em] text-white/90 sm:block">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={routes.notifications}
              className="rounded-xl p-2 text-sidebar-muted transition hover:bg-white/10 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {initials}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-white">{session.user.name}</p>
                <p className="text-[11px] text-sidebar-muted">Owner</p>
              </div>
            </div>
          </div>
        </header>

        {menuOpen ? (
          <div className="border-b border-rail-border bg-rail lg:hidden">
            <NavBody compact />
          </div>
        ) : null}

        <main
          className={`relative z-10 flex-1 overflow-auto ${
            isPos ? "p-0" : "px-4 py-6 sm:px-6 lg:px-8"
          }`}
        >
          <div className={isPos ? "h-full" : "mx-auto max-w-7xl animate-rise"}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
