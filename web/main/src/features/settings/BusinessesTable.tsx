"use client";

import { useRouter } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useBusinessesList } from "@/hooks/queries/useBusinesses";
import type { Business } from "@/types/api/tenancy";

export function BusinessesTable() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useBusinessesList();

  const columns: DataTableColumn<Business>[] = [
    {
      key: "name",
      header: "Business",
      render: (business) => (
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: business.brand_color ?? "transparent" }}
            aria-hidden
          />
          <span className="font-medium">{business.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (business) => <Badge variant="outline">{business.business_type_label}</Badge>,
    },
    { key: "currency", header: "Currency", render: (business) => business.currency },
    {
      key: "branches",
      header: "Branches",
      align: "end",
      render: (business) => business.branches?.length ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (business) => <StatusBadge status={business.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(business) => business.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      search={{ getText: (business) => business.name }}
      onRowClick={(business) => router.push(`/settings/businesses/${business.id}`)}
      mobileCardTitle={(business) => business.name}
      mobileCardSubtitle={(business) => business.business_type_label}
      mobileCardFields={[
        { key: "currency", label: "Currency", render: (business) => business.currency },
        {
          key: "status",
          label: "Status",
          render: (business) => <StatusBadge status={business.status} />,
        },
      ]}
    />
  );
}
