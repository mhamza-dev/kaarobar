import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import DataTable from "@/components/ui/DataTable";
import { Field, PageHeader, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("reports.eyebrow")}
        title={t("pages.reportsTitle")}
        description={t("pages.reportsDesc")}
        infoKey="page.reports"
      />

      {branch ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              [t("dashboard.salesToday"), branch.sales_today],
              [t("reports.tickets"), String(branch.sales_count_today)],
              [t("dashboard.lowStock"), String(branch.low_stock_count)],
              [t("reports.pendingReturns"), String(branch.pending_returns)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-body">{label}</p>
              <p className="mt-1 text-xl font-semibold text-heading">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Field label={t("common.from")}>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label={t("common.to")}>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={fieldClass}
          />
        </Field>
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
            cell: (d) => <span className="tabular-nums font-medium">{d.total}</span>,
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
        toolbar={<span className="text-sm font-semibold text-heading">{t("reports.salesByDay")}</span>}
      />

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
        toolbar={<span className="text-sm font-semibold text-heading">{t("reports.lowStock")}</span>}
      />
    </div>
  );
}
