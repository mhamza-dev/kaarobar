"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";

type SaleItem = {
  product_id: string;
  name: string;
  quantity: string;
  line_total: string;
};

type Sale = {
  id: string;
  invoice_number: string;
  total_amount: string;
  items: SaleItem[];
};

type ReturnRow = {
  id: string;
  sale_id: string;
  status: string;
  refund_amount: string;
  refund_method: string;
  reason?: string;
  items: { product_id: string; quantity: string; amount: string }[];
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  closing_cash?: string | null;
  expected_cash?: string | null;
  over_short?: string | null;
  opened_at?: string;
  closed_at?: string | null;
};

export default function ReturnsPage() {
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [pending, setPending] = useState<ReturnRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [p, r, t] = await Promise.all([
        api<{ data: ReturnRow[] }>("/returns/pending"),
        api<{ data: ReturnRow[] }>("/returns"),
        api<{ data: Till[] }>("/tills"),
      ]);
      setPending(p.data || []);
      setReturns(r.data || []);
      setTills(t.data || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function lookupSale(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await api<{ data: Sale }>(`/sales/${saleId.trim()}`);
      setSale(res.data);
      const initial: Record<string, string> = {};
      for (const item of res.data.items || []) {
        initial[item.product_id] = "";
      }
      setQtyByProduct(initial);
    } catch (err) {
      setSale(null);
      setMessage(err instanceof Error ? err.message : "Sale not found");
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!sale) return;
    const session = getSession();
    const items = Object.entries(qtyByProduct)
      .filter(([, q]) => Number(q) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));

    if (items.length === 0) {
      setMessage("Enter at least one return quantity");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: ReturnRow }>("/returns", {
        method: "POST",
        body: JSON.stringify({
          sale_id: sale.id,
          branch_id: session?.branch_id,
          reason,
          refund_method: refundMethod,
          items,
        }),
      });
      setMessage(`Return ${res.data.status} · Rs ${res.data.refund_amount}`);
      setSale(null);
      setSaleId("");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/approve`, { method: "POST", body: "{}" });
      await reload();
      setMessage("Return approved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by manager" }),
      });
      await reload();
      setMessage("Return rejected");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Returns & tills</h1>
        <p className="text-body">Process refunds, approve pending returns, review till history.</p>
      </div>
      {message ? <p className="text-sm text-body">{message}</p> : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-heading">Create return</h2>
        <form onSubmit={lookupSale} className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-64 flex-1 rounded-lg border border-border px-3 py-2"
            placeholder="Sale ID"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-foreground disabled:opacity-50"
          >
            Lookup
          </button>
        </form>

        {sale ? (
          <form onSubmit={submitReturn} className="mt-4 space-y-3">
            <p className="text-sm text-heading">
              Invoice {sale.invoice_number} · Total Rs {sale.total_amount}
            </p>
            <ul className="space-y-2 text-sm">
              {sale.items.map((item) => (
                <li key={item.product_id} className="flex items-center gap-3 text-heading">
                  <span className="flex-1">
                    {item.name} (sold {item.quantity})
                  </span>
                  <input
                    className="w-24 rounded border border-border px-2 py-1"
                    placeholder="Qty"
                    value={qtyByProduct[item.product_id] || ""}
                    onChange={(e) =>
                      setQtyByProduct((prev) => ({
                        ...prev,
                        [item.product_id]: e.target.value,
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-lg border border-border px-3 py-2"
                value={refundMethod}
                onChange={(e) =>
                  setRefundMethod(e.target.value as "cash" | "card" | "wallet")
                }
              >
                <option value="cash">Cash refund</option>
                <option value="card">Card refund</option>
                <option value="wallet">Wallet refund</option>
              </select>
              <input
                className="min-w-48 flex-1 rounded-lg border border-border px-3 py-2"
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-foreground disabled:opacity-50"
              >
                Submit return
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-heading">Pending approval</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-body">No pending returns</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-heading"
              >
                <div>
                  <div>
                    Rs {r.refund_amount} · {r.refund_method}
                  </div>
                  <div className="text-body">{r.reason || "No reason"}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approve(r.id)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-brand-foreground disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reject(r.id)}
                    className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-heading">Recent returns</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-body">
                <th className="py-2">Status</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Method</th>
                <th className="py-2">Sale</th>
              </tr>
            </thead>
            <tbody>
              {returns.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-t border-border text-heading">
                  <td className="py-2">{r.status}</td>
                  <td className="py-2">{r.refund_amount}</td>
                  <td className="py-2">{r.refund_method}</td>
                  <td className="py-2 font-mono text-xs">{r.sale_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-heading">Till history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-body">
                <th className="py-2">Status</th>
                <th className="py-2">Opening</th>
                <th className="py-2">Expected</th>
                <th className="py-2">Closing</th>
                <th className="py-2">Over/short</th>
              </tr>
            </thead>
            <tbody>
              {tills.map((t) => (
                <tr key={t.id} className="border-t border-border text-heading">
                  <td className="py-2">{t.status}</td>
                  <td className="py-2">{t.opening_cash}</td>
                  <td className="py-2">{t.expected_cash ?? "—"}</td>
                  <td className="py-2">{t.closing_cash ?? "—"}</td>
                  <td className="py-2">{t.over_short ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
