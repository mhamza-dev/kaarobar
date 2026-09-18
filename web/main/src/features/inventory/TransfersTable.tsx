"use client";

import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTransfers } from "@/hooks/queries/useStockOperations";
import { usePermission } from "@/hooks/usePermission";
import { formatDate } from "@/lib/format";
import type { StockTransfer } from "@/types/api/inventory";

import { TransferCreateDialog } from "./TransferCreateDialog";

export function TransfersTable() {
  const router = useRouter();
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useTransfers();
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<StockTransfer>[] = [
    {
      key: "number",
      header: "Transfer",
      render: (t) => <span className="font-medium">{t.number}</span>,
    },
    {
      key: "route",
      header: "Route",
      render: (t) => (
        <div className="flex items-center gap-1.5 text-sm">
          <span>{t.source_branch?.name ?? "—"}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span>{t.destination_branch?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={t.status} />
          {t.in_transit && <Badge variant="outline">In transit</Badge>}
        </div>
      ),
    },
    { key: "dispatched", header: "Dispatched", render: (t) => formatDate(t.dispatched_at) },
    { key: "received", header: "Received", render: (t) => formatDate(t.received_at) },
  ];

  return (
    <>
      {can("stock:transfer") && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New transfer
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(t) => t.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (t) => `${t.number} ${t.source_branch?.name ?? ""}` }}
        filters={[
          {
            id: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "dispatched", label: "Dispatched" },
              { value: "received", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
            ],
            getValue: (t) => t.status,
          },
        ]}
        onRowClick={(t) => router.push(`/stock-transfers/${t.id}`)}
        mobileCardTitle={(t) => t.number}
        mobileCardSubtitle={(t) => `${t.source_branch?.name} → ${t.destination_branch?.name}`}
        mobileCardFields={[
          { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
        ]}
      />

      <TransferCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
