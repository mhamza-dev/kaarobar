"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Boxes,
  ClipboardList,
  ContactRound,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { appNav, appNavGroups, buyerNav, routes } from "@/lib/navigation";
import {
  getSession,
  hydrateSessionContext,
  isConsumerSession,
  logoutSession,
  type StoredSession,
} from "@/lib/api/client";
import { canAccessBundle, canAccessPath, isPlanFeatureLocked } from "@/lib/rbac";
import { toAppPath } from "@/lib/app-path";
import TenantSwitcher from "@/components/app/TenantSwitcher";
import LanguageSwitcher from "@/components/app/LanguageSwitcher";
import KaarobarLogo from "@/components/brand/KaarobarLogo";
import Button from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { CartProvider, useCartOptional } from "@/lib/cart";
import { StaffBrandProvider } from "@/components/app/BrandTheme";
import { useToast } from "@/components/ui/Toast";

const icons = {
  layout: LayoutDashboard,
  pos: ShoppingCart,
  sales: FileText,
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
} as const;

function NavbarCartLink({ sticky = false }: { sticky?: boolean }) {
  const cart = useCartOptional();
  const count = cart?.itemCount ?? 0;
  return (
    <Link
      href="/app/checkout"
      className={`relative shrink-0 rounded-md p-2 transition ${
        sticky
          ? "bg-brand text-brand-foreground shadow-brand hover:brightness-110"
          : "text-rail-muted hover:bg-rail-hover/80 hover:text-heading"
      }`}
      aria-label="Cart"
    >
      <ShoppingCart className="h-4 w-4" strokeWidth={2} />
      {count > 0 ? (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            sticky ? "bg-heading text-white" : "bg-brand text-white"
          }`}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function buyerNavActive(pathname: string, href: string) {
  if (href === "/app") {
    return (
      pathname === "/app" ||
      pathname.startsWith("/app/market/") ||
      pathname === "/app/products" ||
      pathname.startsWith("/app/products/")
    );
  }
  if (href === "/app/account") {
    return (
      pathname === "/app/account" ||
      pathname.startsWith("/app/account/") ||
      pathname === "/app/accounting" ||
      pathname.startsWith("/app/accounting/") ||
      pathname === "/app/notifications" ||
      pathname.startsWith("/app/notifications/")
    );
  }
  if (href === "/app/customers") {
    return pathname === "/app/customers" || pathname.startsWith("/app/customers/");
  }
  if (href === "/app/sales") {
    return pathname === "/app/sales" || pathname.startsWith("/app/sales/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buyerPageTitle(pathname: string, t: (key: string) => string) {
  if (pathname.startsWith("/app/checkout")) return t("pages.checkoutReviewTitle");
  if (pathname.startsWith("/app/market/") && pathname.includes("/product/")) {
    return t("pages.productDetailTitle");
  }
  if (pathname.startsWith("/app/market/")) return t("pages.catalogTitle");
  if (pathname.startsWith("/app/sales/appointments/")) {
    return t("pages.appointmentDetailTitle");
  }
  if (pathname.startsWith("/app/sales/") && pathname !== "/app/sales") {
    return t("marketplace.orderDetailTitle");
  }
  if (pathname.startsWith("/app/accounting")) return t("pages.buyerArTitle");
  if (pathname.startsWith("/app/notifications")) return t("pages.notificationsTitle");
  const item = buyerNav.find((n) => buyerNavActive(pathname, n.href));
  return item ? t(item.titleKey) : t("marketplace.eyebrow");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname();
  const pathname = toAppPath(rawPathname);
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { unread } = useUnreadNotifications();
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState("boot");
  const [planLockHandled, setPlanLockHandled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const current = getSession();
      if (!current) {
        router.replace(routes.login);
        return;
      }

      try {
        const ready = await hydrateSessionContext(current);
        if (cancelled) return;
        setSessionState(ready);
        setTenantKey(`${ready.business_id || ""}:${ready.branch_id || ""}`);
        if (isConsumerSession(ready) && !canAccessPath(ready, pathname)) {
          router.replace("/app");
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
  }, [router, pathname]);

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
    setPlanLockHandled(false);
  }, [pathname]);

  useEffect(() => {
    if (!session || booting || planLockHandled) return;
    if (isConsumerSession(session)) return;
    if (!isPlanFeatureLocked(session, pathname)) return;
    setPlanLockHandled(true);
    toast.error(t("rbac.planFeatureLocked"));
    router.replace(routes.app);
  }, [session, booting, pathname, planLockHandled, router, t, toast]);

  const buyer = isConsumerSession(session);

  const visibleNav = useMemo(
    () =>
      buyer
        ? []
        : appNav.filter((item) => canAccessBundle(session, item.bundle)),
    [session, buyer]
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary text-body">
        <KaarobarLogo size={56} className="rounded-md shadow-brand" />
        <p className="text-sm font-medium">{t("common.workspaceLoading")}</p>
      </div>
    );
  }

  if (!canAccessPath(session, pathname)) {
    const planLocked = isPlanFeatureLocked(session, pathname);
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-center">
        <div>
          <h2 className="text-xl font-bold text-heading">
            {planLocked ? t("rbac.planFeatureLockedTitle") : t("rbac.accessDeniedTitle")}
          </h2>
          <p className="mt-2 text-body">
            {planLocked ? t("rbac.planFeatureLocked") : t("rbac.accessDeniedMessage")}
          </p>
          <Button
            className="mt-4"
            onClick={() =>
              router.push(isConsumerSession(session) ? "/app" : routes.app)
            }
          >
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

  function StaffNavBody({ compact = false }: { compact?: boolean }) {
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
                    className={`nav-pill flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${
                      active
                        ? "nav-pill-active animate-nav-in"
                        : "text-rail-foreground hover:bg-rail-hover/80"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-brand-foreground" : "text-rail-muted"}`}
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

  // —— Buyer marketplace shell (top nav, no staff glass sidebar) ——————————
  if (buyer) {
    return (
      <CartProvider>
        <StaffBrandProvider businessId={null}>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg-primary text-heading">
            <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur-md">
              <div className="mx-auto flex min-h-[4.25rem] max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden text-muted"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Menu"
                  >
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                  <Link href="/app" className="flex min-w-0 items-center gap-2.5">
                    <KaarobarLogo size={36} className="shrink-0 rounded-md shadow-brand" />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-bold tracking-tight text-heading">
                        {t("common.appName")}
                      </p>
                      <p className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-muted sm:block">
                        {t("marketplace.eyebrow")}
                      </p>
                    </div>
                  </Link>
                </div>

                <nav className="hidden items-center gap-1 lg:flex">
                  {buyerNav.map((item) => {
                    const active = buyerNavActive(pathname, item.href);
                    const Icon =
                      item.icon === "pos" ? ShoppingBag : icons[item.icon];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? "bg-brand text-brand-foreground shadow-sm"
                            : "text-body hover:bg-bg-secondary hover:text-heading"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        {t(item.titleKey)}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-2">
                  <NavbarCartLink sticky />
                  <Link
                    href={routes.notifications}
                    className="relative shrink-0 rounded-md p-2 text-muted transition hover:bg-bg-secondary hover:text-heading"
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
                    href="/app/account"
                    className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-card py-1 pl-1 pr-2.5 transition hover:border-brand/30"
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-brand text-xs font-bold text-white">
                      {initials}
                    </span>
                    <span className="hidden max-w-[120px] truncate text-sm font-semibold text-heading sm:block">
                      {session.user.name}
                    </span>
                  </Link>
                </div>
              </div>

              {menuOpen ? (
                <div className="border-t border-border lg:hidden">
                  <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
                    {buyerNav.map((item) => {
                      const active = buyerNavActive(pathname, item.href);
                      const Icon =
                        item.icon === "pos" ? ShoppingBag : icons[item.icon];
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                            active
                              ? "bg-brand text-brand-foreground"
                              : "text-body hover:bg-bg-secondary"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {t(item.titleKey)}
                        </Link>
                      );
                    })}
                    <div className="mt-2 border-t border-border pt-3">
                      <LanguageSwitcher />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void logoutSession();
                        router.push(routes.login);
                      }}
                      className="mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted hover:bg-bg-secondary hover:text-heading"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("common.signOut")}
                    </button>
                  </nav>
                </div>
              ) : null}

              <div className="border-t border-border/80 bg-bg-secondary/60">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
                  <p className="truncate text-sm font-bold text-heading">
                    {buyerPageTitle(pathname, t)}
                  </p>
                  <div className="hidden lg:block">
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            </header>

            <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
              <div
                key={`${tenantKey}:${pathname}`}
                className="mx-auto w-full max-w-7xl animate-rise"
              >
                {children}
              </div>
            </main>
          </div>
        </StaffBrandProvider>
      </CartProvider>
    );
  }

  // —— Staff workspace shell ——————————————————————————————————————————————
  return (
    <CartProvider>
    <StaffBrandProvider businessId={session.business_id}>
    <div className="app-atmosphere flex h-full min-h-0 flex-1 flex-col overflow-hidden text-heading lg:flex-row">
      <aside className="glass-nav relative z-30 hidden h-full min-h-0 w-[248px] shrink-0 flex-col overflow-hidden border-r lg:flex">
        <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/80 px-5 py-4">
          <KaarobarLogo size={40} className="shrink-0 rounded-md shadow-brand" />
          <div>
            <p className="text-sm font-bold tracking-tight text-heading">
              {t("common.appName")}
            </p>
            <p className="text-xs text-rail-muted">{t("common.pointOfSale")}</p>
          </div>
        </div>
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <StaffNavBody />
        </div>
        <div className="relative z-10 mt-auto shrink-0 space-y-3 border-t border-glass-border/80 p-4">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => {
              void logoutSession();
              router.push(routes.login);
            }}
            className="nav-pill flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-rail-muted hover:bg-rail-hover/80 hover:text-heading"
          >
            <LogOut className="h-4 w-4" />
            {t("common.signOut")}
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass-nav sticky top-0 z-20 flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-rail-muted hover:bg-rail-hover hover:text-heading focus:ring-brand/20"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <KaarobarLogo size={36} className="shrink-0 rounded-md shadow-brand lg:hidden" />
            <div className="min-w-0 border-l border-glass-border/80 pl-3 lg:border-l-0 lg:pl-0">
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
            <Link
              href={routes.notifications}
              className="relative shrink-0 rounded-md p-2 text-rail-muted transition hover:bg-rail-hover/80 hover:text-heading"
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
              href={routes.profile}
              className="glass-panel flex shrink-0 items-center gap-2.5 border py-1 pl-1 pr-2.5 transition hover:bg-rail-hover/60 sm:pr-3"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-bold text-white shadow-brand">
                {session.user.profile_pic_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.profile_pic_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
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
          <div className="glass-nav max-h-[min(24rem,50vh)] shrink-0 overflow-y-auto border-b lg:hidden">
            <StaffNavBody compact />
            <div className="border-t border-glass-border/80 px-4 py-3">
              <LanguageSwitcher />
            </div>
          </div>
        ) : null}

        <main
          className={`relative z-10 min-h-0 flex-1 ${isPos ? "overflow-hidden p-0" : "overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
            }`}
        >
          <div
            key={`${tenantKey}:${pathname}`}
            className={
              isPos
                ? "flex h-full min-h-0 flex-col"
                : "mx-auto w-full max-w-7xl animate-rise"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
    </StaffBrandProvider>
    </CartProvider>
  );
}
