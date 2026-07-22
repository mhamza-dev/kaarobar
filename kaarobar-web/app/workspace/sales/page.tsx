"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, isConsumerSession } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { PageHeader, SurfaceCard } from "@/components/app/ui";
import DataTable from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import BuyerOrders from "@/components/buyer/BuyerOrders";

type SaleRow = {
  id: string;
  invoice_number: string;
  total_amount: string;
  status: string;
  customer_name?: string | null;
  inserted_at?: string;
};

export default function SalesListPage() {
  const toast = useToast();
  const router = useRouter();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [buyer, setBuyer] = useState(false);

  useEffect(() => {
    setBuyer(isConsumerSession());
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: SaleRow[] }>("/sales");
      setSales(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sales");
    }
  }, [toast]);

  useEffect(() => {
    if (isConsumerSession()) return;
    void load();
  }, [load]);

  if (buyer) {
    return <BuyerOrders />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cashier"
        title="Sales"
        description="Recent completed sales for this branch."
        infoKey="page.sales"
        secondaryAction={{ label: "Open POS", onClick: () => router.push(routes.pos) }}
      />
      <SurfaceCard className="p-0">
        <DataTable
          searchable
          searchPlaceholder="Search invoice or customer…"
          getSearchText={(s) => `${s.invoice_number} ${s.customer_name || ""}`}
          columns={[
            {
              id: "invoice",
              header: "Invoice",
              cell: (s) => (
                <Link href={detailRoutes.sale(s.id)} className="font-semibold text-brand underline">
                  {s.invoice_number}
                </Link>
              ),
            },
            {
              id: "customer",
              header: "Customer",
              cell: (s) => s.customer_name || "Walk-in",
            },
            {
              id: "total",
              header: "Total",
              cell: (s) => `Rs ${s.total_amount}`,
              align: "right",
            },
            { id: "status", header: "Status", cell: (s) => s.status },
            {
              id: "when",
              header: "When",
              cell: (s) => (s.inserted_at ? String(s.inserted_at).slice(0, 16) : "—"),
            },
          ]}
          data={sales}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(detailRoutes.sale(s.id))}
          emptyTitle="No sales yet"
          emptyBody="Complete a checkout on the POS to see sales here."
        />
      </SurfaceCard>
    </div>
  );
}
