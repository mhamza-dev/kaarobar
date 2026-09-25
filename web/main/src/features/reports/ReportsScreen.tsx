"use client";

import { format, parseISO } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { BarList } from "@/components/charts/BarList";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { LoadError } from "@/components/shared/LoadError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import {
  useDailySales,
  useProductNames,
  useProfitAndLoss,
  useSalesByCashier,
  useSalesByCategory,
  useSalesByHour,
  useSalesByTender,
  useSalesSummary,
  useTaxReport,
  useTopProducts,
} from "@/hooks/queries/useReports";
import { useStaffList } from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney, formatQuantity, humanize } from "@/lib/format";
import {
  compactNumber,
  fillHours,
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from "@/lib/reportPeriod";
import { cn } from "@/lib/utils";
import { downloadReportCsv } from "@/services/reports";
import { useSessionStore } from "@/stores/sessionStore";
import type { DailyRow, ExportableReport, ReportPeriod, TaxRow } from "@/types/api/reports";

/**
 * Sales reporting: one period filter above everything, then a tab per
 * question — how are we doing, what sells, how do people pay, who sold it,
 * what did we make, what tax do we owe.
 *
 * Every figure is the backend's: charts plot a number parsed from the
 * decimal string, but every value a person reads is that string formatted,
 * and CSV exports come from the backend too.
 */
export function ReportsScreen() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: branches } = useBranchesList();

  const [preset, setPreset] = useState<PeriodPreset | "custom">("30d");
  const [custom, setCustom] = useState(presetRange("30d"));
  const [branchId, setBranchId] = useState("");

  const period: ReportPeriod = useMemo(() => {
    const range = preset === "custom" ? custom : presetRange(preset);
    return { ...range, ...(branchId ? { branch_id: branchId } : {}) };
  }, [preset, custom, branchId]);

  const money = (value: string | null | undefined) => formatMoney(value, currency);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Report period">
        {PERIOD_PRESETS.map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={preset === option.key ? "default" : "outline"}
            aria-pressed={preset === option.key}
            onClick={() => setPreset(option.key)}
          >
            {option.label}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="From"
            value={preset === "custom" ? custom.from : period.from}
            max={period.to}
            onChange={(event) => {
              setCustom({ from: event.target.value, to: period.to });
              setPreset("custom");
            }}
            className="h-8 w-38"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="To"
            value={preset === "custom" ? custom.to : period.to}
            min={period.from}
            onChange={(event) => {
              setCustom({ from: period.from, to: event.target.value });
              setPreset("custom");
            }}
            className="h-8 w-38"
          />
        </div>
        {(branches?.length ?? 0) > 1 && (
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            aria-label="Branch"
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">All branches</option>
            {branches!.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          {can("report:staff") && <TabsTrigger value="staff">Staff</TabsTrigger>}
          {can("report:financial") && <TabsTrigger value="profit">Profit</TabsTrigger>}
          {can("report:tax") && <TabsTrigger value="tax">Tax</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Overview period={period} money={money} />
        </TabsContent>
        <TabsContent value="products" className="pt-4">
          <Products period={period} money={money} />
        </TabsContent>
        <TabsContent value="payments" className="pt-4">
          <Payments period={period} money={money} />
        </TabsContent>
        {can("report:staff") && (
          <TabsContent value="staff" className="pt-4">
            <Staff period={period} money={money} />
          </TabsContent>
        )}
        {can("report:financial") && (
          <TabsContent value="profit" className="pt-4">
            <Profit period={period} money={money} />
          </TabsContent>
        )}
        {can("report:tax") && (
          <TabsContent value="tax" className="pt-4">
            <Tax period={period} money={money} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

type Money = (value: string | null | undefined) => string;

function Panel({
  title,
  exportAs,
  period,
  children,
  className,
}: {
  title: string;
  exportAs?: ExportableReport;
  period: ReportPeriod;
  children: React.ReactNode;
  className?: string;
}) {
  const { can } = usePermission();
  const [exporting, setExporting] = useState(false);

  return (
    <section
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {exportAs && can("report:export") && (
          <Button
            variant="ghost"
            size="sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadReportCsv(exportAs, period);
              } catch {
                toast.error("Couldn't export this report");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            CSV
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

type QueryStatus = { isLoading: boolean; isError: boolean; refetch: () => unknown };

/**
 * A panel's body: a skeleton while its report loads, a retry prompt if the
 * request failed, and the content otherwise. Without the error branch a
 * failed report would read as "no sales", which is worse than no answer.
 */
function Loaded({
  query,
  skeleton,
  children,
}: {
  query: QueryStatus;
  skeleton: string;
  children?: React.ReactNode;
}) {
  if (query.isError) return <LoadError what="this report" onRetry={() => query.refetch()} />;
  if (query.isLoading) return <Skeleton className={cn("w-full", skeleton)} />;
  return <>{children}</>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Overview({ period, money }: { period: ReportPeriod; money: Money }) {
  const summary = useSalesSummary(period);
  const daily = useDailySales(period);
  const byHour = useSalesByHour(period);
  const [showTable, setShowTable] = useState(false);

  const points = (daily.data ?? []).map((row) => ({
    label: format(parseISO(row.day), "EEE d MMM yyyy"),
    tick: format(parseISO(row.day), "d MMM"),
    value: Number(row.net_sales),
    display: money(row.net_sales),
    detail: `${row.sale_count} sale${row.sale_count === 1 ? "" : "s"}`,
  }));

  const dailyColumns: DataTableColumn<DailyRow>[] = [
    { key: "day", header: "Day", render: (row) => format(parseISO(row.day), "d MMM yyyy") },
    { key: "count", header: "Sales", align: "end", render: (row) => row.sale_count },
    { key: "gross", header: "Gross", align: "end", render: (row) => money(row.gross_sales) },
    {
      key: "discount",
      header: "Discounts",
      align: "end",
      render: (row) => money(row.discount_total),
    },
    { key: "refunds", header: "Refunds", align: "end", render: (row) => money(row.refund_total) },
    { key: "net", header: "Net", align: "end", render: (row) => money(row.net_sales) },
  ];

  const s = summary.data;

  return (
    <div className="flex flex-col gap-4">
      <Loaded query={summary} skeleton="h-24">
        {s && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Net sales" value={money(s.net_sales)} />
            <Stat label="Sales" value={String(s.sale_count)} detail={`${s.voided_count} voided`} />
            <Stat label="Average sale" value={money(s.average_sale)} />
            <Stat
              label="Gross profit"
              value={money(s.gross_profit)}
              detail={`on ${money(s.cost_total)} cost`}
            />
          </div>
        )}
      </Loaded>

      <Panel title="Net sales by day" exportAs="daily" period={period}>
        <Loaded query={daily} skeleton="h-60">
          <TrendChart
            points={points}
            formatAxis={compactNumber}
            ariaLabel={`Net sales by day from ${period.from} to ${period.to}`}
          />
        </Loaded>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>
            {showTable ? "Hide table" : "Show as table"}
          </Button>
        </div>
        {showTable && (
          <DataTable
            columns={dailyColumns}
            rows={daily.data ?? []}
            rowKey={(row) => row.day}
            embedded
            mobileCardTitle={(row) => format(parseISO(row.day), "d MMM yyyy")}
            mobileCardFields={[{ key: "net", label: "Net", render: (row) => money(row.net_sales) }]}
          />
        )}
      </Panel>

      <Panel title="Takings by hour" period={period}>
        {byHour.isError || byHour.isLoading ? (
          <Loaded query={byHour} skeleton="h-52" />
        ) : (byHour.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <ColumnChart
            columns={fillHours(byHour.data ?? []).map((row) => ({
              key: String(row.hour),
              tick: `${String(row.hour).padStart(2, "0")}:00`,
              label: `${String(row.hour).padStart(2, "0")}:00–${String(row.hour + 1).padStart(2, "0")}:00`,
              value: Number(row.net_sales),
              display: money(row.net_sales),
              detail: `${row.sale_count} sale${row.sale_count === 1 ? "" : "s"}`,
            }))}
            formatAxis={compactNumber}
            ariaLabel="Net sales by hour of day"
          />
        )}
      </Panel>
    </div>
  );
}

function Products({ period, money }: { period: ReportPeriod; money: Money }) {
  const top = useTopProducts(period);
  const byCategory = useSalesByCategory(period);
  const { data: categories } = useCategoriesList();
  const names = useProductNames((top.data ?? []).map((row) => row.product_id));
  const categoryNames = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Product and category figures are built as each day closes — today&apos;s sales appear here
        tomorrow.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top products" exportAs="top_products" period={period}>
          <Loaded query={top} skeleton="h-48">
            <BarList
              items={(top.data ?? []).map((row) => ({
                key: row.variant_id,
                label: names[row.product_id] ?? "…",
                value: Number(row.net_sales),
                display: money(row.net_sales),
                detail: `${formatQuantity(row.quantity)} sold · margin ${money(row.margin)}`,
              }))}
            />
          </Loaded>
        </Panel>
        <Panel title="By category" exportAs="by_category" period={period}>
          <Loaded query={byCategory} skeleton="h-48">
            <BarList
              items={(byCategory.data ?? []).map((row) => ({
                key: row.category_id ?? "none",
                label: row.category_id ? (categoryNames[row.category_id] ?? "…") : "Uncategorised",
                value: Number(row.net_sales),
                display: money(row.net_sales),
                detail: `margin ${money(row.margin)}`,
              }))}
            />
          </Loaded>
        </Panel>
      </div>
    </div>
  );
}

function Payments({ period, money }: { period: ReportPeriod; money: Money }) {
  const tenders = useSalesByTender(period);

  return (
    <Panel title="By payment method" exportAs="by_tender" period={period} className="max-w-2xl">
      <Loaded query={tenders} skeleton="h-40">
        <BarList
          items={(tenders.data ?? []).map((row) => ({
            key: row.method,
            label: humanize(row.method),
            value: Number(row.total),
            display: money(row.total),
            detail: `${row.count} payment${row.count === 1 ? "" : "s"}`,
          }))}
        />
      </Loaded>
    </Panel>
  );
}

function Staff({ period, money }: { period: ReportPeriod; money: Money }) {
  const cashiers = useSalesByCashier(period);
  const { data: staff } = useStaffList();
  const names = Object.fromEntries(
    (staff ?? []).flatMap((member) => (member.user ? [[member.user.id, member.user.name]] : [])),
  );

  return (
    <Panel title="By cashier" exportAs="by_cashier" period={period} className="max-w-2xl">
      <Loaded query={cashiers} skeleton="h-40">
        <BarList
          items={(cashiers.data ?? []).map((row) => ({
            key: row.cashier_id ?? "unknown",
            label: (row.cashier_id && names[row.cashier_id]) || "Unknown",
            value: Number(row.net_sales),
            display: money(row.net_sales),
            detail: `${row.sale_count} sale${row.sale_count === 1 ? "" : "s"} · ${money(row.discount_total)} discounted`,
          }))}
        />
      </Loaded>
    </Panel>
  );
}

function Profit({ period, money }: { period: ReportPeriod; money: Money }) {
  const profit = useProfitAndLoss(period);
  const pl = profit.data;

  if (!pl) {
    return (
      <Panel title="Profit and loss" period={period} className="max-w-xl">
        <Loaded query={profit} skeleton="h-48" />
      </Panel>
    );
  }

  // `less` rows are subtracted in the statement; the sign is presentation,
  // the figures are the backend's own.
  const rows: Array<{ label: string; value: string; less?: boolean; kind?: "sub" | "total" }> = [
    { label: "Revenue", value: pl.revenue },
    { label: "Cost of sales", value: pl.cost_of_sales, less: true },
    { label: "Gross profit", value: pl.gross_profit, kind: "sub" },
    { label: "Operating expenses", value: pl.operating_expenses, less: true },
    { label: "Net profit", value: pl.net_profit, kind: "total" },
  ];

  return (
    <Panel title="Profit and loss" period={period} className="max-w-xl">
      <dl className="flex flex-col text-sm">
        {rows.map(({ label, value, less, kind }) => (
          <div
            key={label}
            className={cn(
              "flex justify-between py-2",
              kind && "border-t border-border font-semibold",
              kind === "total" && "text-base",
            )}
          >
            <dt>{label}</dt>
            <dd className="tabular-nums">
              {less ? "− " : ""}
              {money(value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Tax collected ({money(pl.tax_collected)}) is held for the authority and not counted as
        revenue.
      </p>
    </Panel>
  );
}

function Tax({ period, money }: { period: ReportPeriod; money: Money }) {
  const { data, isLoading, error, refetch } = useTaxReport(period);
  const columns: DataTableColumn<TaxRow>[] = [
    { key: "name", header: "Tax", render: (row) => row.label ?? row.name },
    {
      key: "rate",
      header: "Rate",
      align: "end",
      // The rate is a fraction at full precision (ReportJSON @exact).
      render: (row) => `${Number((Number(row.rate) * 100).toFixed(4))}%`,
    },
    { key: "taxable", header: "Taxable", align: "end", render: (row) => money(row.taxable_total) },
    { key: "tax", header: "Tax", align: "end", render: (row) => money(row.tax_total) },
  ];

  return (
    <Panel title="Tax collected" exportAs="tax" period={period}>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => `${row.name}-${row.rate}`}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        embedded
        mobileCardTitle={(row) => row.label ?? row.name}
        mobileCardFields={[{ key: "tax", label: "Tax", render: (row) => money(row.tax_total) }]}
      />
    </Panel>
  );
}
