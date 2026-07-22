import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type ApBill = {
  id: string;
  bill_number: string;
  supplier_id?: string;
  supplier_name?: string;
  bill_date?: string;
  due_date?: string;
  total_amount: string;
  balance_due: string;
  status: string;
  notes?: string | null;
  journal_entry_id?: string | null;
  payments?: {
    id: string;
    amount: string;
    method: string;
    paid_at?: string;
    reference?: string | null;
  }[];
};

export default function ApBillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [bill, setBill] = useState<ApBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ApBill }>(`/ap/bills/${id}`);
      setBill(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function payFull() {
    if (!bill || Number(bill.balance_due) <= 0) return;
    setBusy(true);
    try {
      await api(`/ap/bills/${bill.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ amount: bill.balance_due, method: "cash" }),
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
      eyebrow="AP bill"
      title={bill?.bill_number || "Bill"}
      subtitle={bill?.supplier_name}
      status={
        bill
          ? {
              label: bill.status,
              tone:
                bill.status === "paid"
                  ? "success"
                  : bill.status === "partial"
                    ? "warning"
                    : "info",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        bill && Number(bill.balance_due) > 0 ? (
          <Button loading={busy} onClick={() => void payFull()}>
            Record full payment
          </Button>
        ) : null
      }
    >
      {bill ? (
        <>
          <DetailSection title="Bill">
            <DetailFieldGrid
              fields={[
                {
                  label: "Supplier",
                  value: bill.supplier_id ? (
                    <Link
                      to={detailRoutes.supplier(bill.supplier_id)}
                      className="text-brand underline"
                    >
                      {bill.supplier_name || "Supplier"}
                    </Link>
                  ) : (
                    bill.supplier_name || "—"
                  ),
                },
                { label: "Bill date", value: bill.bill_date || "—" },
                { label: "Due date", value: bill.due_date || "—" },
                { label: "Total", value: `Rs ${bill.total_amount}` },
                { label: "Balance due", value: `Rs ${bill.balance_due}` },
                {
                  label: "Journal",
                  value: bill.journal_entry_id ? (
                    <Link
                      to={detailRoutes.journal(bill.journal_entry_id)}
                      className="text-brand underline"
                    >
                      View
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Notes", value: bill.notes || "—" },
              ]}
            />
          </DetailSection>
          <DetailSection title="Payments">
            {(bill.payments || []).length === 0 ? (
              <p className="text-sm text-body">No payments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bill.payments!.map((p) => (
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
            )}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
