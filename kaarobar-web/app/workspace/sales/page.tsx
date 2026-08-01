"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, isConsumerSession } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { PageHeader, SurfaceCard } from "@/components/app/ui";
import ListToolbar from "@/components/app/ListToolbar";
import DataTable from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  applyStaffListFilters,
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
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

const SALE_STATUSES = [
  "Completed",
  "Placed",
  "Confirmed",
  "Ready",
  "Voided",
  "Refunded",
];

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
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [filters, setFilters] = useState<StaffListFilterState>(emptyStaffListFilters());

  const filterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: true,
      categoryLabel: t("listFilters.source"),
      categoryOptions: [
        { value: "pos", label: "POS" },
        { value: "online", label: "Online" },
      ],
      statusOptions: SALE_STATUSES.map((s) => ({ value: s, label: s })),
    }),
    [t]
  );

  const load = useCallback(async () => {
    try {
      const source =
        filters.categories.length === 1 ? filters.categories[0] : null;
      const q =
        source && (source === "online" || source === "pos")
          ? `?source=${encodeURIComponent(source)}`
          : "";
      const res = await api<{ data: SaleRow[] }>(`/sales${q}`);
      setSales(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sales");
    }
  }, [toast, filters.categories]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSales = useMemo(
    () =>
      applyStaffListFilters(sales, filters, {
        searchText: (s) => `${s.invoice_number} ${s.customer_name || ""}`,
        date: (s) => s.inserted_at,
        status: (s) => s.status,
        category: (s) => s.source || "pos",
      }),
    [sales, filters]
  );

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
      <SurfaceCard className="p-0">
        <DataTable
          filters={
            <ListToolbar
              value={filters}
              onChange={setFilters}
              config={filterConfig}
              searchPlaceholder="Search invoice or customer…"
            />
          }
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
                      className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold text-brand hover:bg-bg-hover"
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
          data={filteredSales}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(detailRoutes.sale(s.id))}
          emptyTitle="No sales yet"
          emptyBody="Complete a checkout on the POS or receive an online order."
          countLabel={(visible, total) =>
            visible === total
              ? `${total} row${total === 1 ? "" : "s"}`
              : `${visible} of ${sales.length} rows`
          }
        />
      </SurfaceCard>
    </div>
  );
}
