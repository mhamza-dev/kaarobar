"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveCount,
  useCancelCount,
  useCount,
  useRecordCountItem,
  useSubmitCount,
} from "@/hooks/queries/useStockOperations";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney, formatQuantity, formatSigned, isNegative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { StockCountItem } from "@/types/api/inventory";

/**
 * The count sheet, and the variance approval the plan's gate calls for.
 *
 * Counting and approving are separate permissions (`stock:count` and
 * `stock:count_approve`) so the person who counted cannot sign off their own
 * discrepancy — approval is what actually writes the variance into stock.
 */
export function CountDetail({ countId }: { countId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";

  const { data: count, isLoading, isError } = useCount(countId);
  const recordItem = useRecordCountItem(countId);
  const submit = useSubmitCount(countId);
  const approve = useApproveCount(countId);
  const cancel = useCancelCount(countId);

  // Which line is being typed into, so a keystroke doesn't fire a request.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !count) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this count.</p>;
  }

  const isOpen = count.status === "draft" || count.status === "counting";
  // The backend's post-submit status is `awaiting_approval`, not
  // "submitted" (Inventory.StockCount @statuses). Getting this wrong hides
  // the Approve action entirely, stranding every submitted count.
  const isSubmitted = count.status === "awaiting_approval";

  const actions: WorkflowAction[] = [
    {
      key: "submit",
      label: "Submit for approval",
      variant: "default",
      available: isOpen,
      permitted: can("stock:count"),
      pending: submit.isPending,
      confirm: {
        title: `Submit ${count.number}?`,
        description: "Counted lines are locked while someone reviews the variance.",
        confirmLabel: "Submit",
      },
      onAction: async () => {
        await submit.mutateAsync([count.id]);
        toast.success("Count submitted");
      },
    },
    {
      key: "approve",
      label: "Approve variance",
      variant: "default",
      available: isSubmitted,
      permitted: can("stock:count_approve"),
      pending: approve.isPending,
      confirm: {
        title: `Approve ${count.number}?`,
        description: `This writes the variance into stock — ${formatSigned(
          count.variance_quantity,
        )} units, ${formatMoney(count.variance_value, currency)}. It cannot be undone.`,
        confirmLabel: "Approve and adjust stock",
      },
      onAction: async () => {
        await approve.mutateAsync([count.id]);
        toast.success("Variance approved and stock adjusted");
      },
    },
    {
      key: "cancel",
      label: "Cancel",
      variant: "destructive",
      available: isOpen || isSubmitted,
      permitted: can("stock:count"),
      pending: cancel.isPending,
      confirm: {
        title: `Cancel ${count.number}?`,
        description: "The counted figures are discarded and stock is left untouched.",
        confirmLabel: "Cancel count",
        destructive: true,
      },
      onAction: async () => {
        await cancel.mutateAsync([count.id]);
        toast.success("Count cancelled");
        router.push("/stock-counts");
      },
    },
  ];

  const save = async (item: StockCountItem, value: string) => {
    if (value === "" || value === (item.counted_quantity ?? "")) return;
    try {
      await recordItem.mutateAsync([count.id, item.id, { counted_quantity: value }]);
    } catch {
      // Toasted by the hook; the typed value stays so it can be retried.
    }
  };

  const columns: DataTableColumn<StockCountItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => item.variant?.product?.name ?? item.variant?.name ?? "—",
    },
    {
      key: "expected",
      header: "Expected",
      align: "end",
      render: (item) => formatQuantity(item.expected_quantity),
    },
    {
      key: "counted",
      header: "Counted",
      align: "end",
      render: (item) =>
        isOpen && can("stock:count") ? (
          <Input
            value={drafts[item.id] ?? item.counted_quantity ?? ""}
            inputMode="decimal"
            aria-label={`Counted quantity for ${item.variant?.product?.name ?? "line"}`}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
            }
            // Saved on blur rather than per keystroke: each save is a request
            // that recomputes the variance.
            onBlur={(event) => save(item, event.target.value)}
            className="ml-auto w-24 text-right"
          />
        ) : (
          formatQuantity(item.counted_quantity)
        ),
    },
    {
      key: "variance",
      header: "Variance",
      align: "end",
      render: (item) => (
        <span className={cn(isNegative(item.variance) && "text-destructive")}>
          {item.counted ? formatSigned(item.variance) : "—"}
        </span>
      ),
    },
    {
      key: "variance_value",
      header: "Value",
      align: "end",
      render: (item) => formatMoney(item.variance_value, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusBadge status={count.status} />
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Branch</dt>
              <dd>{count.branch?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lines</dt>
              <dd>{count.line_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Variance</dt>
              <dd className={cn(isNegative(count.variance_value) && "text-destructive")}>
                {formatSigned(count.variance_quantity)} (
                {formatMoney(count.variance_value, currency)})
              </dd>
            </div>
          </dl>
        </div>

        <WorkflowActions actions={actions} />
      </div>

      <DataTable
        columns={columns}
        rows={count.items ?? []}
        rowKey={(item) => item.id}
        search={{ getText: (item) => item.variant?.product?.name ?? "" }}
        mobileCardTitle={(item) => item.variant?.product?.name ?? "—"}
        mobileCardFields={[
          {
            key: "expected",
            label: "Expected",
            render: (item) => formatQuantity(item.expected_quantity),
          },
          {
            key: "counted",
            label: "Counted",
            render: (item) => formatQuantity(item.counted_quantity),
          },
        ]}
      />
    </div>
  );
}
