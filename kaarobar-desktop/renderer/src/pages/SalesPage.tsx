import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { PageHeader, SurfaceCard } from "@/components/app/ui";
import DateAndTime from "@/components/app/DateAndTime";
import DataTable from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatLocalDateTime } from "@/lib/datetime";
import { formatDecimal } from "@/lib/decimal";
import {
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
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [toast, filters.categories]);

  useEffect(() => {
    void load();
  }, [load]);

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
          loading={loading}
          filterState={filters}
          onFilterChange={setFilters}
          filterConfig={filterConfig}
          filterAccessors={{
            searchText: (s) => `${s.invoice_number} ${s.customer_name || ""}`,
            date: (s) => s.inserted_at,
            status: (s) => s.status,
            category: (s) => s.source || "pos",
            amount: (s) => s.total_amount,
          }}
          clientFilter
          searchPlaceholder={t("sales.searchInvoice")}
          pagination={{ mode: "client", pageSize: 20 }}
          exportable
          exportFilename="sales"
          exportTitle="Sales"
          getExportRow={(s) => ({
            invoice: s.invoice_number,
            customer: s.customer_name || "Walk-in",
            total: formatDecimal(s.total_amount),
            status: s.status,
            source: s.source || "pos",
            when: formatLocalDateTime(s.inserted_at),
          })}
          exportColumns={[
            { key: "invoice", header: "Invoice" },
            { key: "customer", header: "Customer" },
            { key: "total", header: "Total" },
            { key: "status", header: "Status" },
            { key: "source", header: "Source" },
            { key: "when", header: "When" },
          ]}
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
              cell: (s) => `Rs ${formatDecimal(s.total_amount)}`,
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
              cell: (s) => <DateAndTime value={s.inserted_at} />,
            },
          ]}
          data={sales}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(detailRoutes.sale(s.id))}
          emptyTitle="No sales yet"
          emptyBody="Complete a checkout on the POS to see sales here."
        />
      </SurfaceCard>
    </div>
  );
}
