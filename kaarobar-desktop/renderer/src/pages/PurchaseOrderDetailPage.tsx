import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type PO = {
  id: string;
  status: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  notes?: string | null;
  expected_delivery_date?: string | null;
  branch_id?: string | null;
  items: { product_id: string; quantity: string; unit_cost: string }[];
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [po, setPo] = useState<PO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: PO }>(`/inventory/purchase-orders/${id}`);
      setPo(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api(`/inventory/purchase-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Marked ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const total =
    po?.items.reduce(
      (s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0),
      0,
    ) ?? 0;

  return (
    <DetailShell
      backHref={routes.inventory}
      backLabel="Back to inventory"
      eyebrow="Purchase order"
      title={po ? `PO · ${po.id.slice(0, 8)}` : "Purchase order"}
      subtitle={po?.supplier_name || undefined}
      status={
        po
          ? {
              label: po.status,
              tone:
                po.status === "received" || po.status === "Received"
                  ? "success"
                  : po.status === "cancelled" || po.status === "Cancelled"
                    ? "danger"
                    : "info",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        po && (po.status === "draft" || po.status === "Draft" || po.status === "ordered") ? (
          <>
            {po.status === "draft" || po.status === "Draft" ? (
              <Button loading={busy} onClick={() => void setStatus("ordered")}>
                Mark ordered
              </Button>
            ) : null}
            <Button loading={busy} variant="outline" onClick={() => void setStatus("cancelled")}>
              Cancel
            </Button>
          </>
        ) : null
      }
    >
      {po ? (
        <>
          <DetailSection title="Order">
            <DetailFieldGrid
              fields={[
                {
                  label: "Supplier",
                  value: po.supplier_id ? (
                    <Link
                      to={detailRoutes.supplier(po.supplier_id)}
                      className="text-brand underline"
                    >
                      {po.supplier_name || "Supplier"}
                    </Link>
                  ) : (
                    po.supplier_name || "—"
                  ),
                },
                { label: "Expected delivery", value: po.expected_delivery_date || "—" },
                { label: "Branch", value: po.branch_id || "—" },
                { label: "Notes", value: po.notes || "—" },
                { label: "Line total", value: `Rs ${total.toFixed(2)}` },
              ]}
            />
          </DetailSection>
          <DetailSection title="Lines">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit cost</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((i, idx) => (
                  <tr key={`${i.product_id}-${idx}`} className="border-b border-border/50">
                    <td className="py-2">
                      <Link
                        to={detailRoutes.product(i.product_id)}
                        className="font-medium text-brand underline"
                      >
                        {i.product_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">Rs {i.unit_cost}</td>
                    <td className="py-2 text-right tabular-nums">
                      Rs {(Number(i.quantity) * Number(i.unit_cost)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
