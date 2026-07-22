"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalSession, portalApi } from "@/lib/portal-api";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
};

export default function PortalOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!getPortalSession()) {
      router.replace("/portal/login");
      return;
    }
    void portalApi<{ data: Order[] }>("/portal/orders")
      .then((res) => setOrders(res.data || []))
      .catch(() => router.replace("/portal/login"));
  }, [router]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-heading">Order history</h1>
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {orders.length === 0 ? (
          <li className="p-4 text-sm text-body">No orders yet.</li>
        ) : (
          orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-heading">{o.invoice_number}</p>
                <p className="text-body">
                  {o.inserted_at ? String(o.inserted_at).slice(0, 16) : ""} · {o.status}
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
