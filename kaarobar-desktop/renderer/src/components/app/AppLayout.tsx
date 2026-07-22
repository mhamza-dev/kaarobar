import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Boxes,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  ShoppingCart,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { appNav, appNavGroups, routes } from "@/lib/navigation";
import { clearSession, getSession, hydrateSessionContext, type StoredSession } from "@/lib/api/client";
import { canAccessBundle, canAccessPath } from "@/lib/rbac";
import TenantSwitcher from "@/components/app/TenantSwitcher";
import LanguageSwitcher from "@/components/app/LanguageSwitcher";
import KaarobarLogo from "@/components/brand/KaarobarLogo";
import Button from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";

const icons = {
  layout: LayoutDashboard,
  pos: ShoppingCart,
  returns: Receipt,
  inventory: Boxes,
  customers: ContactRound,
  accounting: BookOpen,
  marketing: Megaphone,
  hr: Users,
  reports: ClipboardList,
  bell: Bell,
  settings: Settings,
  profile: UserRound,
  ess: Wrench,
} as const;

export default function AppLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { t, setLocale } = useI18n();
  const { unread } = useUnreadNotifications();
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState("boot");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const current = getSession();
      if (!current) {
        navigate(routes.login, { replace: true });
        return;
      }

      try {
        const ready = await hydrateSessionContext(current);
        if (cancelled) return;
        setSessionState(ready);
        setTenantKey(`${ready.business_id || ""}:${ready.branch_id || ""}`);
        if (ready.user.locale === "ur" || ready.user.locale === "en") {
          setLocale(ready.user.locale);
        }
      } catch {
        if (!cancelled) setSessionState(current);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, setLocale]);

  useEffect(() => {
    function onSession() {
      const current = getSession();
      if (!current) {
        navigate(routes.login, { replace: true });
        return;
      }
      setSessionState(current);
      setTenantKey(`${current.business_id || ""}:${current.branch_id || ""}`);
    }
    window.addEventListener("kaarobar:session", onSession);
    return () => window.removeEventListener("kaarobar:session", onSession);
  }, [navigate]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const visibleNav = useMemo(
    () => appNav.filter((item) => canAccessBundle(session, item.bundle)),
    [session]
  );

  const grouped = useMemo(
    () =>
      appNavGroups
        .map((groupKey) => ({
          groupKey,
          items: visibleNav.filter((item) => item.groupKey === groupKey),
        }))
        .filter((g) => g.items.length > 0),
    [visibleNav]
  );

  const titleKey =
    visibleNav.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/app" && pathname.startsWith(item.href))
    )?.titleKey ?? "common.appName";
  const isPos = pathname.startsWith("/app/pos");

  if (!session || booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-body">
        {t("common.workspaceLoading")}
      </div>
    );
  }

  if (!canAccessPath(session, pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-center">
        <div>
          <h2 className="text-xl font-bold text-heading">{t("rbac.accessDeniedTitle")}</h2>
          <p className="mt-2 text-body">{t("rbac.accessDeniedMessage")}</p>
          <Button className="mt-4" onClick={() => navigate(routes.app)}>
            {t("rbac.goToDashboard")}
          </Button>
        </div>
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
                const Icon = icons[item.icon as keyof typeof icons] || LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${active
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-primary text-heading lg:flex-row">
      <aside className="relative z-30 hidden min-h-screen w-[248px] shrink-0 flex-col overflow-hidden border-r border-rail-border bg-rail lg:flex">
        <div className="flex shrink-0 items-center gap-3 border-b border-rail-border px-5 py-4">
          <KaarobarLogo size={40} className="shrink-0 shadow-brand rounded-[9px]" />
          <div>
            <p className="text-sm font-bold tracking-tight text-heading">
              {t("common.appName")}
            </p>
            <p className="text-xs text-rail-muted">{t("common.pointOfSale")}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavBody />
        </div>
        <div className="mt-auto shrink-0 space-y-3 border-t border-rail-border p-4">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => {
              clearSession();
              navigate(routes.login);
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-rail-muted transition hover:bg-rail-hover hover:text-heading"
          >
            <LogOut className="h-4 w-4" />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-rail-border bg-rail px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-rail-muted hover:bg-rail-hover hover:text-heading focus:ring-brand/20"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <KaarobarLogo size={36} className="shrink-0 shadow-brand rounded-[8px] lg:hidden" />
            <div className="min-w-0 border-l border-rail-border pl-3 lg:border-l-0 lg:pl-0">
              <p className="mb-0.5 hidden text-[10px] font-bold uppercase tracking-[0.14em] text-rail-muted lg:block">
                {t("common.workspace")}
              </p>
              <h1 className="truncate text-sm font-bold tracking-tight text-heading">
                {t(titleKey)}
              </h1>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <TenantSwitcher />
            <div className="hidden h-6 w-px shrink-0 bg-rail-border sm:block" aria-hidden />
            <div className="hidden sm:block">
              <LanguageSwitcher compact persistToProfile />
            </div>
            <Link
              to={routes.notifications}
              className="relative shrink-0 rounded-md p-2 text-rail-muted transition hover:bg-rail-hover hover:text-heading"
              aria-label={t("nav.notifications")}
            >
              <Bell className="h-4 w-4" strokeWidth={2} />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Link
              to={routes.profile}
              className="flex shrink-0 items-center gap-2.5 rounded-md border border-rail-border bg-card py-1 pl-1 pr-2.5 transition hover:bg-rail-hover sm:pr-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-xs font-bold text-white shadow-brand">
                {initials}
              </span>
              <div className="hidden max-w-[148px] leading-tight lg:block">
                <p className="truncate text-sm font-semibold text-heading">
                  {session.user.name}
                </p>
                <p className="truncate text-[11px] text-rail-muted">
                  {session.user.email}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {menuOpen ? (
          <div className="max-h-[min(24rem,50vh)] shrink-0 overflow-y-auto border-b border-rail-border bg-rail lg:hidden">
            <NavBody compact />
            <div className="border-t border-rail-border px-4 py-3">
              <LanguageSwitcher />
            </div>
          </div>
        ) : null}

        <main
          className={`relative z-10 min-h-0 flex-1 ${isPos ? "overflow-hidden p-0" : "overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
            }`}
        >
          <div
            key={tenantKey}
            className={
              isPos
                ? "flex h-full min-h-0 flex-col"
                : "mx-auto w-full max-w-7xl animate-rise"
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
