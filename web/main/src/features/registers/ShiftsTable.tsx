"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useShifts } from "@/hooks/queries/useRegisters";
import { formatDateTime, formatMoney, isNegative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { Shift } from "@/types/api/sales";

export function ShiftsTable({ onOpenShift }: { onOpenShift?: (shift: Shift) => void }) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useShifts();

  const columns: DataTableColumn<Shift>[] = [
    {
      key: "number",
      header: "Shift",
      render: (shift) => (
        <div>
          <p className="font-medium">{shift.number}</p>
          <p className="text-xs text-muted-foreground">{shift.register?.name ?? ""}</p>
        </div>
      ),
    },
    { key: "opened", header: "Opened", render: (shift) => formatDateTime(shift.opened_at) },
    { key: "closed", header: "Closed", render: (shift) => formatDateTime(shift.closed_at) },
    { key: "sales", header: "Sales", align: "end", render: (shift) => shift.sales_count },
    {
      key: "net",
      header: "Net sales",
      align: "end",
      render: (shift) => formatMoney(shift.net_sales, currency),
    },
    {
      key: "variance",
      header: "Variance",
      align: "end",
      render: (shift) =>
        shift.status === "open" ? (
          "—"
        ) : (
          <span className={cn(isNegative(shift.cash_variance) && "text-destructive")}>
            {formatMoney(shift.cash_variance, currency)}
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (shift) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={shift.status} />
          {shift.status === "closed" && !shift.balanced && <Badge variant="destructive">Out</Badge>}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(shift) => shift.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      search={{ getText: (shift) => `${shift.number} ${shift.register?.name ?? ""}` }}
      filters={[
        {
          id: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
          ],
          getValue: (shift) => shift.status,
        },
      ]}
      onRowClick={onOpenShift}
      mobileCardTitle={(shift) => shift.number}
      mobileCardSubtitle={(shift) => shift.register?.name ?? ""}
      mobileCardFields={[
        {
          key: "net",
          label: "Net sales",
          render: (shift) => formatMoney(shift.net_sales, currency),
        },
      ]}
    />
  );
}
