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
  source?: string;
  customer_name?: string | null;
  inserted_at?: string;
};

const ONLINE_NEXT: Record<string, string | null> = {
  Placed: "Confirmed",
  Confirmed: "Ready",
  Ready: "Completed",
};

export default function SalesListPage() {
  const [ready, setReady] = useState(false);
  const [buyer, setBuyer] = useState(false);

  useEffect(() => {
    setBuyer(isConsumerSession());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-bg-tertiary" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-bg-tertiary" />
        <div className="h-24 animate-pulse rounded-md bg-bg-tertiary" />
        <div className="h-24 animate-pulse rounded-md bg-bg-tertiary" />
      </div>
    );
  }

  if (buyer) {
    return <BuyerOrders />;
  }

  return <StaffSalesListPage />;
}

function StaffSalesListPage() {
  const toast = useToast();
  const router = useRouter();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [source, setSource] = useState<"all" | "online" | "pos">("all");

  const load = useCallback(async () => {
    try {
      const q =
        source === "all" ? "" : `?source=${encodeURIComponent(source)}`;
      const res = await api<{ data: SaleRow[] }>(`/sales${q}`);
      setSales(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sales");
    }
  }, [toast, source]);

  useEffect(() => {
    void load();
  }, [load]);

  async function advanceOnline(sale: SaleRow) {
    const next = ONLINE_NEXT[sale.status];
    if (!next) return;
    try {
      await api(`/sales/${sale.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(`Order ${sale.invoice_number} → ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cashier"
        title="Sales"
        description="Recent sales for this branch, including online marketplace orders."
        infoKey="page.sales"
        secondaryAction={{ label: "Open POS", onClick: () => router.push(routes.pos) }}
      />
      <div className="flex flex-wrap gap-2">
        {(["all", "online", "pos"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              source === s
                ? "bg-brand text-brand-foreground"
                : "border border-border text-heading hover:bg-bg-hover"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>
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
            {
              id: "status",
              header: "Status",
              cell: (s) => (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{s.status}</span>
                  {s.source === "online" && ONLINE_NEXT[s.status] ? (
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-0.5 text-xs font-semibold text-brand hover:bg-bg-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        void advanceOnline(s);
                      }}
                    >
                      → {ONLINE_NEXT[s.status]}
                    </button>
                  ) : null}
                </span>
              ),
            },
            {
              id: "source",
              header: "Source",
              cell: (s) => s.source || "pos",
            },
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
          emptyBody="Complete a checkout on the POS or receive an online order."
        />
      </SurfaceCard>
    </div>
  );
}
