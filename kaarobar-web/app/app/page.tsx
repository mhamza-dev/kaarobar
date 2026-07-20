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
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import Button from "@/components/ui/Button";
import { Alert, KpiCard, PageHeader, SurfaceCard } from "@/components/app/ui";
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
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const dash = await api<{ data: Dashboard }>("/reports/dashboard");
      setDashboard(dash.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const links = [
    {
      href: routes.pos,
      title: "Open POS",
      subtitle: "Checkout & tills",
      icon: ShoppingCart,
      primary: true,
    },
    {
      href: routes.inventory,
      title: "Inventory",
      subtitle: "Stock & purchasing",
      icon: Boxes,
    },
    {
      href: routes.returns,
      title: "Returns",
      subtitle: "Refunds & approvals",
      icon: CheckCircle2,
    },
    {
      href: routes.reports,
      title: "Reports",
      subtitle: "Sales & cash views",
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

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sales today"
          value={dashboard?.sales_today ?? "—"}
          hint="Branch take so far"
          tone="brand"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Cash position"
          value={dashboard?.cash_position ?? "—"}
          hint="Till & cash accounts"
          tone="success"
          icon={<Banknote className="h-5 w-5" />}
        />
        <KpiCard
          label="Low stock"
          value={dashboard?.low_stock_count ?? "—"}
          hint="Needs reorder attention"
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="Approvals"
          value={dashboard?.pending_approvals ?? "—"}
          hint="Returns waiting on you"
          tone="danger"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-heading">Quick actions</h2>
              <p className="mt-1 text-sm text-body">Jump into the flows you use every day.</p>
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
            <h2 className="text-lg font-bold text-heading">Footprint</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Switch business or branch anytime from the top bar — every page follows that context.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-md bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">Businesses</span>
              <strong className="text-lg text-heading">{dashboard?.businesses ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between rounded-md bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">Branches</span>
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
