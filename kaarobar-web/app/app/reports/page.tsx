"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import DataTable from "@/components/ui/DataTable";
import { Alert, Field, PageHeader, fieldClass } from "@/components/app/ui";

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
  const [days, setDays] = useState<DayRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [branch, setBranch] = useState<BranchDash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to load reports");
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Owner and branch operations. Financial statements are under Accounting."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {branch ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Sales today", branch.sales_today],
            ["Tickets", String(branch.sales_count_today)],
            ["Low stock", String(branch.low_stock_count)],
            ["Pending returns", String(branch.pending_returns)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-body">{label}</p>
              <p className="mt-1 text-xl font-semibold text-heading">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Field label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="To">
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
        searchPlaceholder="Search by date…"
        getSearchText={(d) => `${d.date} ${d.total} ${d.count}`}
        columns={[
          { id: "date", header: "Date", cell: (d) => d.date },
          {
            id: "sales",
            header: "Sales",
            align: "right",
            cell: (d) => <span className="tabular-nums font-medium">{d.total}</span>,
          },
          {
            id: "tickets",
            header: "Tickets",
            align: "right",
            cell: (d) => <span className="tabular-nums">{d.count}</span>,
          },
        ]}
        data={days}
        rowKey={(d) => d.date}
        emptyTitle="No sales in range"
        toolbar={<span className="text-sm font-semibold text-heading">Sales by day</span>}
      />

      <DataTable
        maxHeight="22rem"
        searchable
        searchPlaceholder="Search low stock…"
        getSearchText={(r) => `${r.sku} ${r.name} ${r.quantity_on_hand}`}
        columns={[
          {
            id: "sku",
            header: "SKU",
            cell: (r) => <span className="font-medium tabular-nums">{r.sku}</span>,
          },
          { id: "name", header: "Name", cell: (r) => r.name },
          {
            id: "qty",
            header: "On hand",
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
        emptyTitle="Nothing below threshold"
        toolbar={<span className="text-sm font-semibold text-heading">Low stock</span>}
      />
    </div>
  );
}
