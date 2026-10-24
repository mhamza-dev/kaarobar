"use client";

import { format, parseISO, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  ChevronRight,
  Receipt,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
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
import { compactNumber, presetRange, shopToday } from "@/lib/reportPeriod";
import { changeBetween, formatChange } from "@/lib/trend";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

import { NeedsAttention } from "./NeedsAttention";
import { RecentSales } from "./RecentSales";

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

  // The shop's today, not the browser's — they differ for hours every day
  // for an owner away from the shop.
  const timezone = scope?.business?.timezone;
  const today = useMemo(() => presetRange("today", shopToday(timezone)), [timezone]);
  const lastFortnight = useMemo(() => {
    const now = shopToday(timezone);
    return { from: format(subDays(now, 13), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }, [timezone]);

  const summary = useSalesSummary(today, canReport);
  const trend = useDailySales(lastFortnight, canReport);
  // Product figures come from the nightly rollups (closed days only), so
  // "today" would always be empty — the week is the honest window.
  const week = useMemo(() => presetRange("7d", shopToday(timezone)), [timezone]);
  const top = useTopProducts(week, canReport);
  const names = useProductNames((top.data ?? []).slice(0, 5).map((row) => row.product_id));
  const fiscal = useFiscalStatus();
  const canSeeSales = can("sale:view") || can("sale:view_all");

  // Yesterday and the weeks come off the fortnight's series rather than
  // extra requests: its last point is today, live, and the rest are
  // closed days.
  const days = trend.data ?? [];
  const yesterday = days.at(-2);
  // Until the first sale lands, "−100% on yesterday" is true and useless.
  const tradedToday = (summary.data?.sale_count ?? 0) > 0;
  const vsYesterday = {
    net:
      yesterday && tradedToday
        ? changeBetween(Number(summary.data?.net_sales ?? 0), Number(yesterday.net_sales))
        : null,
    count:
      yesterday && tradedToday
        ? changeBetween(summary.data?.sale_count ?? 0, yesterday.sale_count)
        : null,
  };
  const sumNet = (rows: typeof days) =>
    rows.reduce((total, row) => total + Number(row.net_sales), 0);
  const thisWeek = sumNet(days.slice(-7));
  const weekTotals = {
    current: thisWeek.toFixed(2),
    change: days.length >= 14 ? changeBetween(thisWeek, sumNet(days.slice(-14, -7))) : null,
  };
  const netToday = Number(summary.data?.net_sales ?? 0);
  const margin =
    netToday > 0 ? Math.round((Number(summary.data?.gross_profit ?? 0) / netToday) * 100) : null;

  const shortcuts = getVisibleNavGroups(scope)
    .flatMap((group) => group.items)
    .filter((item) => item.href !== "/dashboard")
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {canSeeFiscal && fiscal.data?.selling_blocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-danger shadow-xs">
            <AlertTriangle className="size-[1.125rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-danger">The till is blocked by fiscal reporting</p>
            <p className="text-foreground/80">
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
          <section
            aria-label="Today at a glance"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              label="Net sales today"
              icon={Banknote}
              loading={summary.isLoading}
              value={formatMoney(summary.data?.net_sales, currency)}
              change={vsYesterday.net}
              changeLabel="vs yesterday"
              hint={!tradedToday && !summary.isLoading ? "No sales yet today" : undefined}
            />
            <StatCard
              label="Sales today"
              icon={ShoppingBag}
              loading={summary.isLoading}
              value={summary.data?.sale_count ?? "—"}
              change={vsYesterday.count}
              changeLabel="vs yesterday"
            />
            <StatCard
              label="Average sale"
              icon={Receipt}
              loading={summary.isLoading}
              value={formatMoney(summary.data?.average_sale, currency)}
              hint={
                summary.data?.voided_count
                  ? `${summary.data.voided_count} voided today`
                  : "Per completed sale"
              }
            />
            {can("report:financial") ? (
              <StatCard
                label="Gross profit today"
                icon={TrendingUp}
                loading={summary.isLoading}
                value={formatMoney(summary.data?.gross_profit, currency)}
                hint={margin !== null ? `${margin}% margin` : "After cost of goods"}
              />
            ) : (
              <StatCard
                label="Last 7 days"
                icon={TrendingUp}
                loading={trend.isLoading}
                value={formatMoney(String(weekTotals.current), currency)}
                change={weekTotals.change}
                changeLabel="vs the week before"
              />
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            <div className={cn(PANEL, "flex flex-col gap-4 p-5 md:p-6 lg:col-span-3")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Net sales</h2>
                  <p className="text-xs text-muted-foreground">
                    Last 14 days
                    {weekTotals.change !== null &&
                      ` · this week ${formatChange(weekTotals.change)} on the one before`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/reports" />}
                  className="-mt-1 -mr-2"
                >
                  Reports <ArrowRight className="size-3.5" />
                </Button>
              </div>
              {trend.isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <TrendChart
                  height={230}
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

            <div className="flex flex-col lg:col-span-2 [&>section]:flex-1">
              <NeedsAttention />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className={cn(PANEL, "flex flex-col gap-4 p-5 md:p-6")}>
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
            </div>

            {canSeeSales && <RecentSales currency={currency} />}
            <QuickLinks items={quickLinks(scope)} />
          </section>
        </>
      ) : (
        <>
          <NeedsAttention />
          {shortcuts.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    PANEL,
                    "group flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              ))}
            </section>
          ) : (
            <EmptyState
              title="Nothing to show yet"
              description="Ask an owner to give your role access to the screens you need."
            />
          )}
          {canSeeSales && <RecentSales currency={currency} />}
        </>
      )}
    </div>
  );
}

const PANEL = "rounded-xl border border-border bg-card shadow-card";

/**
 * The everyday jobs, phrased as jobs, in the order a shop reaches for them.
 * Only screens the sidebar would show this person make the list.
 */
const QUICK_LINKS: Array<{ href: string; label: string }> = [
  { href: "/pos", label: "Ring up a sale" },
  { href: "/products", label: "Manage products" },
  { href: "/customers", label: "Find a customer" },
  { href: "/stock", label: "Check stock levels" },
  { href: "/purchase-orders", label: "Order from suppliers" },
  { href: "/expenses", label: "Record an expense" },
  { href: "/sales", label: "Look up a sale" },
];

function quickLinks(scope: Parameters<typeof getVisibleNavGroups>[0]) {
  const visible = new Map(
    getVisibleNavGroups(scope)
      .flatMap((group) => group.items)
      .map((item) => [item.href, item]),
  );
  return QUICK_LINKS.flatMap((link) => {
    const item = visible.get(link.href);
    return item ? [{ ...link, icon: item.icon }] : [];
  }).slice(0, 5);
}

function QuickLinks({ items }: { items: ReturnType<typeof quickLinks> }) {
  if (items.length === 0) return null;

  return (
    <div className={cn(PANEL, "flex flex-col gap-3 p-5 md:p-6")}>
      <div>
        <h2 className="text-sm font-semibold">Shortcuts</h2>
        <p className="text-xs text-muted-foreground">The everyday jobs, one click away.</p>
      </div>
      <ul className="-mx-2 flex flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <item.icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1">{item.label}</span>
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
