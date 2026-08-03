"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Package } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert, StatusBadge } from "@/components/app/ui";
import InfoButton from "@/components/ui/InfoButton";
import { BuyerBackLink, BuyerCard } from "@/components/buyer/BuyerLayout";
import { BuyerOrderDetailSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";

export type PortalOrder = {
  id: string;
  business_id?: string;
  business_name?: string | null;
  invoice_number: string;
  source?: string;
  subtotal?: string;
  tax_amount?: string;
  discount_amount?: string;
  total_amount: string;
  status: string;
  notes?: string | null;
  inserted_at?: string;
  items?: {
    name?: string | null;
    quantity: string;
    unit_price: string;
    line_total: string;
  }[];
  payments?: { method: string; amount: string }[];
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "ready") return "success";
  if (s === "cancelled") return "danger";
  if (s === "placed" || s === "confirmed") return "warning";
  return "info";
}

/** Buyer order detail — `/app/sales/[id]` when actor=consumer. */
export default function BuyerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [order, setOrder] = useState<PortalOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    void api<{ data: PortalOrder }>(`/portal/orders/${id}`)
      .then((res) => {
        setOrder(res.data);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <BuyerOrderDetailSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <BuyerBackLink href="/app/sales">{t("marketplace.backToOrders")}</BuyerBackLink>
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  if (!order) return null;

  const items = order.items || [];

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-rise">
      <BuyerBackLink href="/app/sales">{t("marketplace.backToOrders")}</BuyerBackLink>

      <BuyerCard className="p-0">
        <div className="border-b border-border bg-gradient-to-br from-brand-soft/80 to-transparent px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-brand">
                <Package className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {t("marketplace.eyebrow")}
                  </p>
                  <InfoButton topicId="page.buyer.orderDetail" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
                  {order.invoice_number}
                </h1>
                <p className="mt-1 text-sm text-body">
                  {order.business_name || t("marketplace.store")}
                  {order.inserted_at
                    ? ` · ${new Date(order.inserted_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(order.status)}>{order.status}</StatusBadge>
              {order.source === "online" ? (
                <StatusBadge tone="info">{t("marketplace.onlineBadge")}</StatusBadge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            {t("marketplace.lineItems")}
          </h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-body">{t("marketplace.noLineItems")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {items.map((line, idx) => (
                <li
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">
                      {line.name || t("marketplace.item")}
                    </p>
                    <p className="text-sm text-body">
                      {line.quantity} × Rs {formatDecimal(line.unit_price)}
                    </p>
                  </div>
                  <p className="font-bold text-heading">Rs {formatDecimal(line.line_total)}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            {order.subtotal != null ? (
              <div className="flex justify-between text-body">
                <span>{t("common.subtotal")}</span>
                <span>Rs {formatDecimal(order.subtotal)}</span>
              </div>
            ) : null}
            {order.tax_amount && Number(order.tax_amount) !== 0 ? (
              <div className="flex justify-between text-body">
                <span>{t("marketplace.tax")}</span>
                <span>Rs {formatDecimal(order.tax_amount)}</span>
              </div>
            ) : null}
            {order.discount_amount && Number(order.discount_amount) !== 0 ? (
              <div className="flex justify-between text-body">
                <span>{t("marketplace.discount")}</span>
                <span>− Rs {formatDecimal(order.discount_amount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-1 text-base font-bold text-heading">
              <span>{t("common.total")}</span>
              <span>Rs {formatDecimal(order.total_amount)}</span>
            </div>
          </div>

          {order.payments && order.payments.length > 0 ? (
            <div className="mt-5 rounded-md bg-bg-secondary/80 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {t("marketplace.payment")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-body">
                {order.payments.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="capitalize">{p.method}</span>
                    <span className="font-semibold text-heading">Rs {formatDecimal(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {order.notes ? (
            <p className="mt-4 text-sm text-body">
              <span className="font-semibold text-heading">{t("marketplace.notes")}: </span>
              {order.notes}
            </p>
          ) : null}
        </div>
      </BuyerCard>
    </div>
  );
}
