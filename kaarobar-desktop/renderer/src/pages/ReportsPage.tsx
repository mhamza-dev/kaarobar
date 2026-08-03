import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  RotateCcw,
  Ticket,
} from "lucide-react";
import { api } from "@/lib/api/client";
import DateRangeFields from "@/components/app/DateRangeFields";
import DataTable from "@/components/ui/DataTable";
import { KpiCard, PageHeader } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDecimal } from "@/lib/decimal";
import { useT } from "@/lib/i18n";

type DayRow = { date: string; total: string; count: number };
type LowStock = {
  product_id: string;
  sku: string;
  name: string;
  quantity_on_hand: string;
};
type BranchDash = {
  sales_today: string;
  sales_count_today: number;
  low_stock_count: number;
  pending_returns: number;
};

export default function ReportsPage() {
  const t = useT();
  const toast = useToast();
  const [days, setDays] = useState<DayRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [branch, setBranch] = useState<BranchDash | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const [sales, stock, br] = await Promise.all([
        api<{ data: DayRow[] }>(`/reports/sales-by-day?from=${from}&to=${to}`),
        api<{ data: LowStock[] }>("/reports/low-stock"),
        api<{ data: BranchDash }>("/reports/branch").catch(() => ({ data: null })),
      ]);
      setDays(sales.data || []);
      setLowStock(stock.data || []);
      setBranch(br.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reports.loadFailed"));
    }
  }, [from, t, toast, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("reports.eyebrow")}
        title={t("pages.reportsTitle")}
        description={t("pages.reportsDesc")}
        infoKey="page.reports"
      />

      {branch ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("dashboard.salesToday")}
            value={formatDecimal(branch.sales_today)}
            tone="brand"
            icon={<Banknote className="h-5 w-5" />}
          />
          <KpiCard
            label={t("reports.tickets")}
            value={branch.sales_count_today}
            tone="success"
            icon={<Ticket className="h-5 w-5" />}
          />
          <KpiCard
            label={t("dashboard.lowStock")}
            value={branch.low_stock_count}
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <KpiCard
            label={t("reports.pendingReturns")}
            value={branch.pending_returns}
            tone="danger"
            icon={<RotateCcw className="h-5 w-5" />}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-heading">{t("reports.salesByDay")}</h2>
          <p className="mt-1 text-sm text-body">{t("reports.salesByDayDesc")}</p>
        </div>
        <DateRangeFields
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          className="w-full max-w-md sm:w-auto sm:min-w-[16rem]"
        />
      </div>

      <DataTable
        maxHeight="22rem"
        searchable
        searchPlaceholder={t("reports.searchDate")}
        getSearchText={(d) => `${d.date} ${d.total} ${d.count}`}
        columns={[
          { id: "date", header: t("common.date"), cell: (d) => d.date },
          {
            id: "sales",
            header: t("dashboard.salesToday"),
            align: "right",
            cell: (d) => (
              <span className="tabular-nums font-medium">{formatDecimal(d.total)}</span>
            ),
          },
          {
            id: "tickets",
            header: t("reports.tickets"),
            align: "right",
            cell: (d) => <span className="tabular-nums">{d.count}</span>,
          },
        ]}
        data={days}
        rowKey={(d) => d.date}
        emptyTitle={t("reports.noSalesInRange")}
      />

      <div>
        <h2 className="mb-4 text-lg font-bold text-heading">{t("reports.lowStock")}</h2>
        <DataTable
          maxHeight="22rem"
          searchable
          searchPlaceholder={t("reports.searchLowStock")}
          getSearchText={(r) => `${r.sku} ${r.name} ${r.quantity_on_hand}`}
          columns={[
            {
              id: "sku",
              header: t("common.sku"),
              cell: (r) => <span className="font-medium tabular-nums">{r.sku}</span>,
            },
            { id: "name", header: t("common.name"), cell: (r) => r.name },
            {
              id: "qty",
              header: t("inventory.onHand"),
              align: "right",
              cell: (r) => (
                <span className="tabular-nums font-semibold text-warning">
                  {r.quantity_on_hand}
                </span>
              ),
            },
          ]}
          data={lowStock}
          rowKey={(r) => r.product_id}
          emptyTitle={t("reports.nothingBelowThreshold")}
        />
      </div>
    </div>
  );
}
