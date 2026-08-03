"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { api, getSession, isConsumerSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { canAccessBundle } from "@/lib/rbac";
import DateRangeFields from "@/components/app/DateRangeFields";
import DashboardCharts, {
  fillSalesDays,
  type SalesDayRow,
} from "@/components/app/DashboardCharts";
import { KpiCard, PageHeader, SurfaceCard } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import BuyerMarketDiscover from "@/components/buyer/BuyerMarketDiscover";

type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
  businesses: number;
  branches: number;
};

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppDashboardPage() {
  if (isConsumerSession()) {
    return <BuyerMarketDiscover />;
  }

  return <StaffDashboardPage />;
}

function StaffDashboardPage() {
  const t = useT();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [salesDays, setSalesDays] = useState<SalesDayRow[]>([]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [chartsLoading, setChartsLoading] = useState(false);

  const loadKpis = useCallback(async () => {
    const current = getSession();
    if (!current?.business_id) return;
    if (!canAccessBundle(current, "reports")) {
      setDashboard(null);
      return;
    }

    try {
      const dash = await api<{ data: Dashboard }>("/reports/dashboard");
      setDashboard(dash.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("dashboard.loadFailed");
      if (message === "business_required" || message === "forbidden_role") return;
      toast.error(message);
    }
  }, [t, toast]);

  const loadCharts = useCallback(async () => {
    const current = getSession();
    if (!current?.business_id) return;
    if (!canAccessBundle(current, "reports")) {
      setSalesDays([]);
      return;
    }
    if (!from || !to) return;

    setChartsLoading(true);
    try {
      // RPT-FR-001 — tenant-scoped sales time series
      const sales = await api<{ data: SalesDayRow[] }>(
        `/reports/sales-by-day?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      setSalesDays(sales.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("dashboard.loadFailed");
      if (message === "business_required" || message === "forbidden_role") {
        setSalesDays([]);
        return;
      }
      toast.error(message);
    } finally {
      setChartsLoading(false);
    }
  }, [from, t, to, toast]);

  useEffect(() => {
    loadKpis();
    function onSession() {
      if (!isConsumerSession()) {
        loadKpis();
        loadCharts();
      }
    }
    window.addEventListener("kaarobar:session", onSession);
    return () => window.removeEventListener("kaarobar:session", onSession);
  }, [loadCharts, loadKpis]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const chartPoints = useMemo(
    () => fillSalesDays(salesDays, from, to),
    [from, salesDays, to]
  );

  const session = getSession();
  const roles = (session?.memberships || [])
    .filter((m) => !session?.business_id || m.business_id === session.business_id)
    .flatMap((m) => m.roles || []);
  const roleFocus = roles.includes("owner")
    ? "owner"
    : roles.includes("marketing")
      ? "marketing"
      : roles.includes("cashier")
        ? "cashier"
        : roles.includes("accountant")
          ? "accountant"
          : roles.includes("hr_manager")
            ? "hr"
            : "staff";

  const roleWidgets =
    roleFocus === "marketing"
      ? [
          { label: "Open marketing", href: routes.marketing, body: "Send campaigns & manage coupons" },
          { label: "Customers", href: routes.customers, body: "Consent & loyalty points" },
        ]
      : roleFocus === "cashier"
        ? [
            { label: "Open POS", href: routes.pos, body: "Take sales, apply coupons" },
            { label: "Returns", href: routes.returns, body: "Process returns" },
          ]
        : roleFocus === "accountant"
          ? [
              { label: "Accounting", href: routes.accounting, body: "Books & statements" },
              { label: "Reports", href: routes.reports, body: "P&L and trial balance" },
            ]
          : roleFocus === "hr"
            ? [
                { label: "HR & payroll", href: routes.hr, body: "Attendance and payslips" },
              ]
            : [
                { label: "Sales today", href: routes.reports, body: dashboard?.sales_today ?? "—" },
                { label: "Low stock", href: routes.inventory, body: String(dashboard?.low_stock_count ?? "—") },
              ];

  const canCharts = canAccessBundle(session, "reports");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("nav.overview")}
        title={t("pages.dashboardTitle")}
        description={t("pages.dashboardDesc")}
        infoKey="page.dashboard"
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

      {canCharts ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-heading">{t("dashboard.trendsTitle")}</h2>
            <p className="mt-1 text-sm text-body">{t("dashboard.chartsDesc")}</p>
          </div>
          <DateRangeFields
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            className="w-full max-w-md sm:w-auto"
          />
        </div>
      ) : null}

      {canCharts ? (
        <DashboardCharts points={chartPoints} loading={chartsLoading} />
      ) : null}

      <SurfaceCard className="p-5">
        <h2 className="text-lg font-bold text-heading">
          For you · {roleFocus}
        </h2>
        <p className="mt-1 text-sm text-body">
          Role-focused shortcuts (TEN-FR-013).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roleWidgets.map((w) => (
            <Link
              key={w.href + w.label}
              href={w.href}
              className="rounded-md border border-border bg-card-muted p-4 transition hover:border-brand/30"
            >
              <p className="font-semibold text-heading">{w.label}</p>
              <p className="mt-1 text-sm text-body">{w.body}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
