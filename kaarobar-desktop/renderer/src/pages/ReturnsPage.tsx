import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import {
  PageHeader,
  StatusBadge,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";
import { canAccessBundle } from "@/lib/rbac";

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
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const canApprove = canAccessBundle(getSession(), "pos_approve");
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [pending, setPending] = useState<ReturnRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
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
      toast.error(err instanceof Error ? err.message : t("returns.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function lookupSale(e: React.FormEvent) {
    e.preventDefault();
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
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      toast.warning(t("common.quantity"));
      return;
    }

    setBusy(true);
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
      toast.success(`${t("returns.returnSubmitted")} · ${res.data.refund_amount}`);
      setSale(null);
      setSaleId("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/approve`, { method: "POST", body: "{}" });
      await reload();
      toast.success(t("returns.returnApproved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      toast.success(t("returns.returnRejected"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("returns.eyebrow")}
        title={t("pages.returnsTitle")}
        description={t("pages.returnsDesc")}
        infoKey="page.returns"
      />

      <SurfaceCard className="p-5">
        <h2 className="font-semibold text-heading">Create return</h2>
        <form onSubmit={lookupSale} className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${fieldClass} min-w-64 flex-1`}
            placeholder="Sale ID"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy} loading={busy}>
            Lookup
          </Button>
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
                className="rounded-md border border-border px-3 py-2"
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
                className="min-w-48 flex-1 rounded-md border border-border px-3 py-2"
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand px-4 py-2 font-medium text-brand-foreground disabled:opacity-50"
              >
                Submit return
              </button>
            </div>
          </form>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="p-5">
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
                  <div className="flex items-center gap-2">
                    <Link
                      to={detailRoutes.saleReturn(r.id)}
                      className="font-semibold text-brand underline"
                    >
                      Rs {r.refund_amount}
                    </Link>
                    <span>· {r.refund_method}</span>
                    <StatusBadge tone="warning">{r.status}</StatusBadge>
                  </div>
                  <div className="text-body">{r.reason || "No reason"}</div>
                </div>
                <div className="flex gap-2">
                  {canApprove ? (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => approve(r.id)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => reject(r.id)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Awaiting owner/admin</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          maxHeight="22rem"
          searchable
          searchPlaceholder="Search returns…"
          getSearchText={(r) =>
            `${r.status} ${r.refund_amount} ${r.refund_method} ${r.sale_id} ${r.reason ?? ""}`
          }
          onRowClick={(r) => navigate(detailRoutes.saleReturn(r.id))}
          columns={[
            {
              id: "status",
              header: "Status",
              cell: (r) => (
                <StatusBadge
                  tone={
                    r.status === "approved" || r.status === "Approved"
                      ? "success"
                      : r.status === "rejected" || r.status === "Rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {r.status}
                </StatusBadge>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              align: "right",
              cell: (r) => (
                <Link
                  to={detailRoutes.saleReturn(r.id)}
                  className="tabular-nums font-medium text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.refund_amount}
                </Link>
              ),
            },
            { id: "method", header: "Method", cell: (r) => r.refund_method },
            {
              id: "sale",
              header: "Sale",
              cell: (r) => (
                <Link
                  to={detailRoutes.sale(r.sale_id)}
                  className="font-mono text-xs text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.sale_id.slice(0, 8)}…
                </Link>
              ),
            },
          ]}
          data={returns}
          rowKey={(r) => r.id}
          emptyTitle="No returns yet"
          toolbar={<span className="text-sm font-semibold text-heading">Recent returns</span>}
        />

        <DataTable
          maxHeight="22rem"
          searchable
          searchPlaceholder="Search tills…"
          getSearchText={(t) =>
            `${t.status} ${t.opening_cash} ${t.expected_cash ?? ""} ${t.closing_cash ?? ""}`
          }
          columns={[
            { id: "status", header: "Status", cell: (t) => t.status },
            {
              id: "opening",
              header: "Opening",
              align: "right",
              cell: (t) => <span className="tabular-nums">{t.opening_cash}</span>,
            },
            {
              id: "expected",
              header: "Expected",
              align: "right",
              cell: (t) => (
                <span className="tabular-nums">{t.expected_cash ?? "—"}</span>
              ),
            },
            {
              id: "closing",
              header: "Closing",
              align: "right",
              cell: (t) => (
                <span className="tabular-nums">{t.closing_cash ?? "—"}</span>
              ),
            },
            {
              id: "over",
              header: "Over/short",
              align: "right",
              cell: (t) => (
                <span className="tabular-nums">{t.over_short ?? "—"}</span>
              ),
            },
          ]}
          data={tills}
          rowKey={(t) => t.id}
          emptyTitle="No till sessions"
          toolbar={<span className="text-sm font-semibold text-heading">Till history</span>}
        />
      </div>
    </div>
  );
}
