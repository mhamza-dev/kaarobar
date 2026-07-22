import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type ArInvoice = {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  sale_id?: string | null;
  invoice_date?: string;
  due_date?: string;
  subtotal?: string;
  tax_amount?: string;
  total_amount: string;
  balance_due: string;
  status: string;
  notes?: string | null;
  payments?: {
    id: string;
    amount: string;
    method: string;
    paid_at?: string;
    reference?: string | null;
  }[];
};

export default function ArInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [invoice, setInvoice] = useState<ArInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ArInvoice }>(`/ar/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function payFull() {
    if (!invoice || Number(invoice.balance_due) <= 0) return;
    setBusy(true);
    try {
      await api(`/ar/invoices/${invoice.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ amount: invoice.balance_due, method: "cash" }),
      });
      toast.success("Payment recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailShell
      backHref={routes.accounting}
      backLabel="Back to accounting"
      eyebrow="AR invoice"
      title={invoice?.invoice_number || "Invoice"}
      subtitle={invoice?.customer_name}
      status={
        invoice
          ? {
              label: invoice.status,
              tone:
                invoice.status === "paid"
                  ? "success"
                  : invoice.status === "partial"
                    ? "warning"
                    : "info",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        invoice && Number(invoice.balance_due) > 0 ? (
          <Button loading={busy} onClick={() => void payFull()}>
            Record full payment
          </Button>
        ) : null
      }
    >
      {invoice ? (
        <>
          <DetailSection title="Invoice">
            <DetailFieldGrid
              fields={[
                {
                  label: "Customer",
                  value: invoice.customer_id ? (
                    <Link
                      to={detailRoutes.customer(invoice.customer_id)}
                      className="text-brand underline"
                    >
                      {invoice.customer_name || "Customer"}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Sale",
                  value: invoice.sale_id ? (
                    <Link
                      to={detailRoutes.sale(invoice.sale_id)}
                      className="text-brand underline"
                    >
                      View sale
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Invoice date", value: invoice.invoice_date || "—" },
                { label: "Due date", value: invoice.due_date || "—" },
                { label: "Total", value: `Rs ${invoice.total_amount}` },
                { label: "Balance due", value: `Rs ${invoice.balance_due}` },
              ]}
            />
          </DetailSection>

          <DetailSection title="Payments">
            <ul className="space-y-2 text-sm">
              {(invoice.payments || []).map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-md border border-border px-3 py-2"
                >
                  <span>
                    {p.method}
                    {p.paid_at ? ` · ${String(p.paid_at).slice(0, 16)}` : ""}
                  </span>
                  <span className="font-semibold">Rs {p.amount}</span>
                </li>
              ))}
            </ul>
            {(invoice.payments || []).length === 0 ? (
              <p className="text-sm text-body">No payments yet.</p>
            ) : null}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
