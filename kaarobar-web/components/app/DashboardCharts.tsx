"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SurfaceCard } from "@/components/app/ui";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";

export type SalesDayRow = { date: string; total: string; count: number };

export type ChartPoint = {
  date: string;
  label: string;
  total: number;
  count: number;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

/** Fill missing calendar days so charts stay continuous (RPT-FR-001). */
export function fillSalesDays(
  rows: SalesDayRow[],
  from: string,
  to: string
): ChartPoint[] {
  const map = new Map(rows.map((r) => [r.date.slice(0, 10), r]));
  const out: ChartPoint[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toYmd(cursor);
    const row = map.get(key);
    out.push({
      date: key,
      label: shortLabel(key),
      total: row ? Number(row.total) || 0 : 0,
      count: row?.count ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueKey,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  valueKey: "total" | "count";
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value ?? 0;
  const display = valueKey === "total" ? formatDecimal(raw) : String(raw);
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-heading">{label}</p>
      <p className="mt-0.5 text-body">
        {valueLabel}: <span className="tabular-nums font-semibold text-heading">{display}</span>
      </p>
    </div>
  );
}

type DashboardChartsProps = {
  points: ChartPoint[];
  loading?: boolean;
};

export default function DashboardCharts({ points, loading }: DashboardChartsProps) {
  const t = useT();
  const totals = useMemo(() => {
    return points.reduce(
      (acc, p) => ({
        revenue: acc.revenue + p.total,
        orders: acc.orders + p.count,
      }),
      { revenue: 0, orders: 0 }
    );
  }, [points]);

  const empty = !loading && points.every((p) => p.total === 0 && p.count === 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SurfaceCard className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-heading">
              {t("dashboard.revenueOverTime")}
            </h2>
            <p className="mt-1 text-sm text-body">{t("dashboard.chartsDesc")}</p>
          </div>
          <div className="rounded-md bg-bg-tertiary px-3 py-2 text-end">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              {t("dashboard.rangeRevenue")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">
              {formatDecimal(totals.revenue)}
            </p>
          </div>
        </div>
        <div className="mt-4 h-64 w-full">
          {empty ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {t("dashboard.noChartData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => formatDecimal(Number(v))}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueKey="total"
                      valueLabel={t("dashboard.revenueOverTime")}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#dashRevenue)"
                  activeDot={{ r: 4, fill: "var(--brand)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-heading">
              {t("dashboard.ordersOverTime")}
            </h2>
            <p className="mt-1 text-sm text-body">{t("reports.tickets")}</p>
          </div>
          <div className="rounded-md bg-bg-tertiary px-3 py-2 text-end">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              {t("dashboard.rangeOrders")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">
              {totals.orders}
            </p>
          </div>
        </div>
        <div className="mt-4 h-64 w-full">
          {empty ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {t("dashboard.noChartData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  content={
                    <ChartTooltip valueKey="count" valueLabel={t("reports.tickets")} />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--brand)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
