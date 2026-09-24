"use client";

import { format, parseISO, subDays } from "date-fns";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiscalStatus } from "@/hooks/queries/useFinance";
import {
  useDailySales,
  useProductNames,
  useSalesSummary,
  useTopProducts,
} from "@/hooks/queries/useReports";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney, formatQuantity } from "@/lib/format";
import { getVisibleNavGroups } from "@/lib/nav";
import { compactNumber, presetRange } from "@/lib/reportPeriod";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * The first screen after sign-in. Leads with one number — today's net
 * sales — then the fortnight's shape and what's selling today. Someone
 * without `report:sales` gets their shortcuts instead of a wall of 403s.
 *
 * The fiscal banner is here because it's the one condition that stops the
 * till opening; finding out at the till is too late.
 */
export function Dashboard() {
  const { can } = usePermission();
  const scope = useSessionStore((state) => state.scope);
  const currency = scope?.business?.currency ?? "PKR";
  const canReport = can("report:sales");
  const canSeeFiscal = can("fiscal:view");

  const today = useMemo(() => presetRange("today"), []);
  const lastFortnight = useMemo(() => {
    const now = new Date();
    return { from: format(subDays(now, 13), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }, []);

  const summary = useSalesSummary(today, canReport);
  const trend = useDailySales(lastFortnight, canReport);
  // Product figures come from the nightly rollups (closed days only), so
  // "today" would always be empty — the week is the honest window.
  const week = useMemo(() => presetRange("7d"), []);
  const top = useTopProducts(week, canReport);
  const names = useProductNames((top.data ?? []).slice(0, 5).map((row) => row.product_id));
  const fiscal = useFiscalStatus();

  const shortcuts = getVisibleNavGroups(scope)
    .flatMap((group) => group.items)
    .filter((item) => item.href !== "/dashboard")
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {canSeeFiscal && fiscal.data?.selling_blocked && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive bg-danger-soft p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="font-medium">The till is blocked by fiscal reporting</p>
            <p className="text-muted-foreground">
              {fiscal.data.backlog} sale{fiscal.data.backlog === 1 ? "" : "s"} couldn&apos;t be
              reported to the tax authority.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/settings/fiscal" />}
          >
            Fix it
          </Button>
        </div>
      )}

      {canReport ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[2fr_3fr]">
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5">
              <div>
                <p className="text-sm text-muted-foreground">Net sales today</p>
                {summary.isLoading ? (
                  <Skeleton className="mt-2 h-12 w-48" />
                ) : (
                  <p className="mt-1 text-5xl font-semibold tracking-tight">
                    {formatMoney(summary.data?.net_sales, currency)}
                  </p>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Sales</dt>
                  <dd className="text-lg font-semibold">{summary.data?.sale_count ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Average</dt>
                  <dd className="text-lg font-semibold">
                    {formatMoney(summary.data?.average_sale, currency)}
                  </dd>
                </div>
                {can("report:financial") && (
                  <div>
                    <dt className="text-muted-foreground">Gross profit</dt>
                    <dd className="text-lg font-semibold">
                      {formatMoney(summary.data?.gross_profit, currency)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Last 14 days</h2>
                <Link
                  href="/reports"
                  className="flex items-center gap-1 text-sm text-brand-primary hover:underline"
                >
                  Reports <ArrowRight className="size-3.5" />
                </Link>
              </div>
              {trend.isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <TrendChart
                  height={180}
                  points={(trend.data ?? []).map((row) => ({
                    label: format(parseISO(row.day), "EEE d MMM"),
                    tick: format(parseISO(row.day), "d MMM"),
                    value: Number(row.net_sales),
                    display: formatMoney(row.net_sales, currency),
                    detail: `${row.sale_count} sale${row.sale_count === 1 ? "" : "s"}`,
                  }))}
                  formatAxis={compactNumber}
                  ariaLabel="Net sales for the last 14 days"
                />
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 lg:max-w-xl">
            <div>
              <h2 className="text-sm font-semibold">Best sellers this week</h2>
              <p className="text-xs text-muted-foreground">Updated as each day closes.</p>
            </div>
            {top.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <BarList
                emptyMessage="No closed days with sales this week yet."
                items={(top.data ?? []).slice(0, 5).map((row) => ({
                  key: row.variant_id,
                  label: names[row.product_id] ?? "…",
                  value: Number(row.net_sales),
                  display: formatMoney(row.net_sales, currency),
                  detail: `${formatQuantity(row.quantity)} sold`,
                }))}
              />
            )}
          </section>
        </>
      ) : shortcuts.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted"
            >
              <item.icon className="size-5 text-brand-primary" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Nothing to show yet"
          description="Ask an owner to give your role access to the screens you need."
        />
      )}
    </div>
  );
}
