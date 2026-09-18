"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useCounts, useCreateCount } from "@/hooks/queries/useStockOperations";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, formatSigned, isNegative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { StockCount } from "@/types/api/inventory";

export function CountsTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useCounts();
  const { data: branches } = useBranchesList();
  const createCount = useCreateCount();
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<StockCount>[] = [
    {
      key: "number",
      header: "Count",
      render: (c) => <span className="font-medium">{c.number}</span>,
    },
    { key: "branch", header: "Branch", render: (c) => c.branch?.name ?? "—" },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "lines", header: "Lines", align: "end", render: (c) => c.line_count },
    {
      key: "variance",
      header: "Variance",
      align: "end",
      render: (c) => (
        <span className={cn(isNegative(c.variance_value) && "text-destructive")}>
          {formatSigned(c.variance_quantity)}
        </span>
      ),
    },
    {
      key: "variance_value",
      header: "Value",
      align: "end",
      render: (c) => formatMoney(c.variance_value, currency),
    },
    { key: "started", header: "Started", render: (c) => formatDate(c.started_at) },
  ];

  return (
    <>
      {can("stock:count") && (
        <div className="mb-3 flex justify-end">
          <Button
            disabled={creating}
            onClick={async () => {
              const branchId = useSessionStore.getState().scope?.branch?.id ?? branches?.[0]?.id;

              if (!branchId) {
                toast.error("No branch to count — add one first.");
                return;
              }

              setCreating(true);
              try {
                const count = (await createCount.mutateAsync([
                  { branch_id: branchId },
                ])) as StockCount;
                router.push(`/stock-counts/${count.id}`);
              } catch {
                // Toasted by the hook.
              } finally {
                setCreating(false);
              }
            }}
          >
            <Plus className="size-4" />
            Start a count
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(c) => c.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (c) => `${c.number} ${c.branch?.name ?? ""}` }}
        filters={[
          {
            id: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "counting", label: "Counting" },
              { value: "awaiting_approval", label: "Awaiting approval" },
              { value: "approved", label: "Approved" },
              { value: "cancelled", label: "Cancelled" },
            ],
            getValue: (c) => c.status,
          },
        ]}
        onRowClick={(c) => router.push(`/stock-counts/${c.id}`)}
        mobileCardTitle={(c) => c.number}
        mobileCardSubtitle={(c) => c.branch?.name ?? ""}
        mobileCardFields={[
          { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
          {
            key: "variance",
            label: "Variance",
            render: (c) => formatSigned(c.variance_quantity),
          },
        ]}
      />
    </>
  );
}
