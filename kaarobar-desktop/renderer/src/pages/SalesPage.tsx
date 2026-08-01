import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
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

type SaleRow = {
  id: string;
  invoice_number: string;
  total_amount: string;
  status: string;
  source?: string;
  customer_name?: string | null;
  inserted_at?: string;
};

const SALE_STATUSES = [
  "Completed",
  "Placed",
  "Confirmed",
  "Ready",
  "Voided",
  "Refunded",
];

export default function SalesPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cashier"
        title="Sales"
        description="Recent completed sales for this branch."
        infoKey="page.sales"
        secondaryAction={{ label: "Open POS", onClick: () => navigate(routes.pos) }}
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
                <Link to={detailRoutes.sale(s.id)} className="font-semibold text-brand underline">
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
          onRowClick={(s) => navigate(detailRoutes.sale(s.id))}
          emptyTitle="No sales yet"
          emptyBody="Complete a checkout on the POS to see sales here."
        />
      </SurfaceCard>
    </div>
  );
}
