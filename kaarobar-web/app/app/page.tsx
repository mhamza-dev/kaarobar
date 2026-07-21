"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { api, getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import Button from "@/components/ui/Button";
import { KpiCard, PageHeader, SurfaceCard } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
  businesses: number;
  branches: number;
};

export default function AppDashboardPage() {
  const t = useT();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    const current = getSession();
    if (!current?.business_id) return;

    try {
      const dash = await api<{ data: Dashboard }>("/reports/dashboard");
      setDashboard(dash.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("dashboard.loadFailed");
      if (message === "business_required") return;
      toast.error(message);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
    function onSession() {
      load();
    }
    window.addEventListener("kaarobar:session", onSession);
    return () => window.removeEventListener("kaarobar:session", onSession);
  }, [load]);

  const links = [
    {
      href: routes.pos,
      title: t("pages.openPos"),
      subtitle: t("dashboard.openPosSub"),
      icon: ShoppingCart,
      primary: true,
    },
    {
      href: routes.inventory,
      title: t("nav.inventory"),
      subtitle: t("dashboard.inventorySub"),
      icon: Boxes,
    },
    {
      href: routes.returns,
      title: t("nav.returns"),
      subtitle: t("dashboard.returnsSub"),
      icon: CheckCircle2,
    },
    {
      href: routes.reports,
      title: t("nav.reports"),
      subtitle: t("dashboard.reportsSub"),
      icon: TrendingUp,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("nav.overview")}
        title={t("pages.dashboardTitle")}
        description={t("pages.dashboardDesc")}
        action={{
          label: t("pages.openPos"),
          onClick: () => {
            window.location.href = routes.pos;
          },
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("dashboard.salesToday")}
          value={dashboard?.sales_today ?? "—"}
          hint={t("dashboard.salesTodayHint")}
          tone="brand"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label={t("dashboard.cashPosition")}
          value={dashboard?.cash_position ?? "—"}
          hint={t("dashboard.cashPositionHint")}
          tone="success"
          icon={<Banknote className="h-5 w-5" />}
        />
        <KpiCard
          label={t("dashboard.lowStock")}
          value={dashboard?.low_stock_count ?? "—"}
          hint={t("dashboard.lowStockHint")}
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label={t("dashboard.approvals")}
          value={dashboard?.pending_approvals ?? "—"}
          hint={t("dashboard.approvalsHint")}
          tone="danger"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-heading">
                {t("dashboard.quickActions")}
              </h2>
              <p className="mt-1 text-sm text-body">
                {t("dashboard.quickActionsDesc")}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-md border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    "primary" in item && item.primary
                      ? "border-brand/20 bg-brand text-white shadow-brand"
                      : "border-border bg-card-muted hover:border-brand/30"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-md ${
                      "primary" in item && item.primary
                        ? "bg-white/15 text-white"
                        : "bg-brand-soft text-brand"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span
                      className={`block font-semibold ${
                        "primary" in item && item.primary ? "text-white" : "text-heading"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`text-sm ${
                        "primary" in item && item.primary ? "text-white/80" : "text-body"
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex flex-col justify-between p-5">
          <div>
            <h2 className="text-lg font-bold text-heading">{t("dashboard.footprint")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {t("dashboard.footprintDesc")}
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-md bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">{t("dashboard.businesses")}</span>
              <strong className="text-lg text-heading">{dashboard?.businesses ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between rounded-md bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">{t("dashboard.branches")}</span>
              <strong className="text-lg text-heading">{dashboard?.branches ?? "—"}</strong>
            </div>
            <Link href={routes.settings} className="block">
              <Button variant="outline" className="w-full">
                {t("pages.manageSettings")}
              </Button>
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
