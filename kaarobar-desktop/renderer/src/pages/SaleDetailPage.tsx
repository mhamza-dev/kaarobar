import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import SaleReceiptModal, { type ReceiptSale } from "@/components/app/SaleReceiptModal";

type Sale = ReceiptSale & {
  status: string;
  customer_id?: string | null;
  ar_invoice_id?: string | null;
  fbr_invoice_no?: string | null;
  branch_id?: string;
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Sale }>(`/sales/${id}`);
      setSale(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sale");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <DetailShell
        backHref={routes.sales}
        backLabel="Back to sales"
        eyebrow="Sale"
        title={sale?.invoice_number || "Sale"}
        subtitle={
          sale?.inserted_at ? new Date(sale.inserted_at).toLocaleString() : undefined
        }
        status={
          sale
            ? {
                label: sale.status,
                tone: sale.status === "Completed" ? "success" : "info",
              }
            : undefined
        }
        loading={loading}
        error={error}
        actions={
          sale ? <Button onClick={() => setPrintOpen(true)}>Print receipt</Button> : null
        }
      >
        {sale ? (
          <>
            <DetailSection title="Summary">
              <DetailFieldGrid
                fields={[
                  {
                    label: "Customer",
                    value: sale.customer_id ? (
                      <Link
                        to={detailRoutes.customer(sale.customer_id)}
                        className="text-brand underline"
                      >
                        {sale.customer_name || sale.customer_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "Walk-in"
                    ),
                  },
                  { label: "Subtotal", value: `Rs ${sale.subtotal}` },
                  { label: "Tax", value: `Rs ${sale.tax_amount}` },
                  { label: "Discount", value: `Rs ${sale.discount_amount || "0"}` },
                  { label: "Total", value: `Rs ${sale.total_amount}` },
                  { label: "FBR invoice", value: sale.fbr_invoice_no || "—" },
                  {
                    label: "AR invoice",
                    value: sale.ar_invoice_id ? (
                      <Link
                        to={detailRoutes.arInvoice(sale.ar_invoice_id)}
                        className="text-brand underline"
                      >
                        View
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title="Line items">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="border-b border-border/50">
                      <td className="py-2 font-medium text-heading">{item.name}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.unit_price}</td>
                      <td className="py-2 text-right">{item.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DetailSection>

            <DetailSection title="Payments">
              <ul className="space-y-2 text-sm">
                {sale.payments.map((p, idx) => (
                  <li
                    key={`${p.method}-${idx}`}
                    className="flex justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="capitalize text-heading">{p.method}</span>
                    <span className="font-semibold">Rs {p.amount}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>
          </>
        ) : null}
      </DetailShell>

      <SaleReceiptModal sale={printOpen ? sale : null} onClose={() => setPrintOpen(false)} />
    </>
  );
}
