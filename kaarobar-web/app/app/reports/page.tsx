"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

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
      <div>
        <h1 className="text-2xl font-bold text-heading">Reports</h1>
        <p className="text-body">Owner and branch operations. Financial statements are under Accounting.</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {branch ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Sales today", branch.sales_today],
            ["Tickets", String(branch.sales_count_today)],
            ["Low stock", String(branch.low_stock_count)],
            ["Pending returns", String(branch.pending_returns)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-body">{label}</p>
              <p className="mt-1 text-xl font-semibold text-heading">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-heading">
          From{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-1 rounded border border-border px-2 py-1"
          />
        </label>
        <label className="text-sm text-heading">
          To{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-1 rounded border border-border px-2 py-1"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-subtle">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Sales</th>
              <th className="px-4 py-3">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-body" colSpan={3}>
                  No sales in range
                </td>
              </tr>
            ) : (
              days.map((d) => (
                <tr key={d.date} className="border-t border-border text-heading">
                  <td className="px-4 py-2">{d.date}</td>
                  <td className="px-4 py-2">{d.total}</td>
                  <td className="px-4 py-2">{d.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-heading">Low stock</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">On hand</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-body" colSpan={3}>
                    Nothing below threshold
                  </td>
                </tr>
              ) : (
                lowStock.map((r) => (
                  <tr key={r.product_id} className="border-t border-border text-heading">
                    <td className="px-4 py-2">{r.sku}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">{r.quantity_on_hand}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
