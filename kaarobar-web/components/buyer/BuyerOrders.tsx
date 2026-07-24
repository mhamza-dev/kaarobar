"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  Alert,
  EmptyState,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/app/ui";
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

  useEffect(() => {
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => setOrders(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

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
        <p className="text-sm text-body">Loading orders…</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="Browse Discover and place your first pickup order."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-heading">{o.invoice_number}</p>
                    <StatusBadge tone={statusTone(o.status)}>{o.status}</StatusBadge>
                    {o.source === "online" ? (
                      <StatusBadge tone="info">Online</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-body">
                    {o.business_name ? `${o.business_name} · ` : ""}
                    {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
                  </p>
                </div>
                <p className="text-lg font-bold text-heading">Rs {o.total_amount}</p>
              </SurfaceCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
