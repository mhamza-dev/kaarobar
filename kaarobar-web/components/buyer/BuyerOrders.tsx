"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
};

/** Buyer view of `/app/sales`. */
export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: Order[] }>("/portal/orders")
      .then((res) => setOrders(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-heading">Order history</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {orders.length === 0 ? (
          <li className="p-4 text-sm text-body">No orders yet.</li>
        ) : (
          orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-heading">{o.invoice_number}</p>
                <p className="text-body">
                  {o.business_name ? `${o.business_name} · ` : ""}
                  {o.inserted_at ? String(o.inserted_at).slice(0, 16) : ""} · {o.status}
                  {o.source === "online" ? " · online" : ""}
                </p>
              </div>
              <p className="font-bold text-heading">Rs {o.total_amount}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
