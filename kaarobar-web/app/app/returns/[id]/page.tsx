"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { canAccessBundle } from "@/lib/rbac";
import { getSession } from "@/lib/api/client";

type ReturnDetail = {
  id: string;
  sale_id: string;
  status: string;
  refund_amount: string;
  refund_method: string;
  till_id?: string | null;
  reason?: string | null;
  rejection_reason?: string | null;
  items: { product_id: string; sale_item_id?: string; quantity: string; amount: string }[];
};

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const canApprove = canAccessBundle(getSession(), "pos_approve");
  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ReturnDetail }>(`/returns/${id}`);
      setRet(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load return");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    try {
      await api(`/returns/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "reject" ? { reason: "Rejected" } : {}),
      });
      toast.success(action === "approve" ? "Return approved" : "Return rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const pending = ret?.status === "PendingApproval" || ret?.status === "pending_approval";

  return (
    <DetailShell
      backHref={routes.returns}
      backLabel="Back to returns"
      eyebrow="Return"
      title={ret ? `Return · Rs ${ret.refund_amount}` : "Return"}
      subtitle={ret?.reason || undefined}
      status={
        ret
          ? {
              label: ret.status,
              tone:
                ret.status === "Approved" || ret.status === "approved"
                  ? "success"
                  : pending
                    ? "warning"
                    : "danger",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        pending && canApprove ? (
          <>
            <Button loading={busy} onClick={() => void act("approve")}>
              Approve
            </Button>
            <Button loading={busy} variant="outline" onClick={() => void act("reject")}>
              Reject
            </Button>
          </>
        ) : null
      }
    >
      {ret ? (
        <>
          <DetailSection title="Summary">
            <DetailFieldGrid
              fields={[
                {
                  label: "Sale",
                  value: (
                    <Link href={detailRoutes.sale(ret.sale_id)} className="text-brand underline">
                      View sale
                    </Link>
                  ),
                },
                { label: "Refund method", value: ret.refund_method },
                { label: "Refund amount", value: `Rs ${ret.refund_amount}` },
                { label: "Till", value: ret.till_id || "—" },
                { label: "Rejection reason", value: ret.rejection_reason || "—" },
              ]}
            />
          </DetailSection>
          <DetailSection title="Items">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ret.items.map((i, idx) => (
                  <tr key={`${i.product_id}-${idx}`} className="border-b border-border/50">
                    <td className="py-2">
                      <Link
                        href={detailRoutes.product(i.product_id)}
                        className="font-medium text-brand underline"
                      >
                        {i.product_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">Rs {i.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
          <Button variant="outline" onClick={() => router.push(routes.returns)}>
            Back to list
          </Button>
        </>
      ) : null}
    </DetailShell>
  );
}
