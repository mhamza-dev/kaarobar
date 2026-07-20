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
  UserRound,
  Users,
  X,
} from "lucide-react";
import { appNav, appNavGroups, routes } from "@/lib/navigation";
import { clearSession, getSession, setSession, type StoredSession, api } from "@/lib/api/client";
import TenantSwitcher from "@/components/app/TenantSwitcher";
import LanguageSwitcher from "@/components/app/LanguageSwitcher";
import Button from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";

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
  profile: UserRound,
} as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, setLocale } = useI18n();
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState("boot");

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(routes.login);
      return;
    }
    setSessionState(current);
    setTenantKey(`${current.business_id || ""}:${current.branch_id || ""}`);
    if (current.user.locale === "ur" || current.user.locale === "en") {
      setLocale(current.user.locale);
    }
  }, [router, setLocale]);

  useEffect(() => {
    function onSession() {
      const current = getSession();
      if (!current) {
        router.replace(routes.login);
        return;
      }
      setSessionState(current);
      setTenantKey(`${current.business_id || ""}:${current.branch_id || ""}`);
    }
    window.addEventListener("kaarobar:session", onSession);
    return () => window.removeEventListener("kaarobar:session", onSession);
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const grouped = useMemo(
    () =>
      appNavGroups
        .map((groupKey) => ({
          groupKey,
          items: appNav.filter((item) => item.groupKey === groupKey),
        }))
        .filter((g) => g.items.length > 0),
    []
  );

  const titleKey =
    appNav.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/app" && pathname.startsWith(item.href))
    )?.titleKey ?? "common.appName";
  const isPos = pathname.startsWith("/app/pos");

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-body">
        {t("common.workspaceLoading")}
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
        {grouped.map(({ groupKey, items }) => (
          <div key={groupKey}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-rail-muted">
              {t(groupKey)}
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
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand text-white shadow-sm"
                        : "text-rail-foreground hover:bg-rail-hover"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-rail-muted"}`}
                      strokeWidth={2}
                    />
                    {t(item.titleKey)}
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
      <aside className="relative z-30 hidden w-[248px] shrink-0 flex-col border-r border-rail-border bg-rail lg:flex">
        <div className="flex items-center gap-3 border-b border-rail-border px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-sm font-bold text-white shadow-brand">
            K
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-heading">
              {t("common.appName")}
            </p>
            <p className="text-xs text-rail-muted">{t("common.pointOfSale")}</p>
          </div>
        </div>
        <NavBody />
        <div className="mt-auto space-y-3 border-t border-rail-border p-4">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push(routes.login);
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-rail-muted transition hover:bg-rail-hover hover:text-heading"
          >
            <LogOut className="h-4 w-4" />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-white/10 hover:text-white focus:ring-white/20"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="truncate text-sm font-semibold tracking-wide text-white">
              {t(titleKey)}
            </h1>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <TenantSwitcher />
            <div className="hidden h-6 w-px shrink-0 bg-white/10 sm:block" aria-hidden />
            <div className="hidden sm:block">
              <select
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white outline-none"
                value={session.user.locale === "ur" ? "ur" : "en"}
                onChange={(e) => {
                  const next = e.target.value as "en" | "ur";
                  setLocale(next);
                  void api<{ user?: { locale?: string } }>("/auth/me", {
                    method: "PATCH",
                    body: JSON.stringify({ locale: next }),
                  })
                    .then((res) => {
                      const current = getSession();
                      if (current && res.user) {
                        setSession({
                          ...current,
                          user: {
                            ...current.user,
                            locale: res.user.locale === "ur" ? "ur" : "en",
                          },
                        });
                      }
                    })
                    .catch(() => {
                      /* local switch still applies */
                    });
                }}
                aria-label={t("common.language")}
              >
                <option value="en" className="text-heading">
                  {t("common.english")}
                </option>
                <option value="ur" className="text-heading">
                  {t("common.urdu")}
                </option>
              </select>
            </div>
            <Link
              href={routes.notifications}
              className="shrink-0 rounded-md p-2 text-sidebar-muted transition hover:bg-white/10 hover:text-white"
              aria-label={t("nav.notifications")}
            >
              <Bell className="h-4 w-4" />
            </Link>
            <Link
              href={routes.profile}
              className="flex shrink-0 items-center gap-2.5 rounded-md border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 transition hover:bg-white/10 sm:pr-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-xs font-bold text-white">
                {initials}
              </span>
              <div className="hidden max-w-[148px] leading-tight lg:block">
                <p className="truncate text-sm font-semibold text-white">
                  {session.user.name}
                </p>
                <p className="truncate text-[11px] text-sidebar-muted">
                  {session.user.email}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {menuOpen ? (
          <div className="border-b border-rail-border bg-rail lg:hidden">
            <NavBody compact />
            <div className="border-t border-rail-border px-4 py-3">
              <LanguageSwitcher />
            </div>
          </div>
        ) : null}

        <main
          className={`relative z-10 flex-1 overflow-auto ${
            isPos ? "p-0" : "px-4 py-6 sm:px-6 lg:px-8"
          }`}
        >
          <div
            key={tenantKey}
            className={isPos ? "h-full" : "mx-auto w-full max-w-7xl animate-rise"}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
