"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  Alert,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/app/ui";
import { BuyerOrderListSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "ready") return "success";
  if (s === "cancelled") return "danger";
  if (s === "placed" || s === "confirmed") return "warning";
  return "info";
}

/** Buyer view of `/app/sales`. */
export default function BuyerOrders() {
  const t = useT();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => {
        setOrders(res.data || []);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerOrdersTitle")}
        description={t("pages.buyerOrdersDesc")}
        infoKey="page.buyer.orders"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <BuyerOrderListSkeleton />
      ) : orders.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-dashed border-brand/30 bg-gradient-to-b from-brand-light/60 to-card px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-brand">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <EmptyState
            title={t("marketplace.emptyOrdersTitle")}
            body={t("marketplace.emptyOrdersBody")}
          />
          <Link
            href="/app"
            className="mt-2 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
          >
            {t("marketplace.browseStores")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/app/sales/${o.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand">
                  {(o.business_name || "O").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-heading">{o.invoice_number}</p>
                    <StatusBadge tone={statusTone(o.status)}>{o.status}</StatusBadge>
                    {o.source === "online" ? (
                      <StatusBadge tone="info">{t("marketplace.onlineBadge")}</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-body">
                    {o.business_name ? `${o.business_name} · ` : ""}
                    {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-bold text-heading">
                  Rs {o.total_amount}
                </p>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted transition group-hover:text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
