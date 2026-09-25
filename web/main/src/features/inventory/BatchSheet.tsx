"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetBatchStatus, useStockMoves } from "@/hooks/queries/useInventory";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatSigned,
  humanize,
} from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Batch, StockMove } from "@/types/api/inventory";

type StatusChange = { status: string; label: string; description: string; destructive?: boolean };

/**
 * Where a batch can be moved by hand. Depleted and expired are the
 * backend's to set as stock runs out or the date passes; a person's
 * decisions are to pull a batch from sale (quarantine, recall) or put a
 * quarantined one back.
 */
function statusChanges(batch: Batch): StatusChange[] {
  if (batch.status === "active") {
    return [
      {
        status: "quarantined",
        label: "Quarantine",
        description: "It stays in stock but can't be sold until it's released.",
      },
      {
        status: "recalled",
        label: "Recall",
        description: "The supplier or maker has recalled it. It can no longer be sold.",
        destructive: true,
      },
    ];
  }
  if (batch.status === "quarantined") {
    return [
      {
        status: "active",
        label: "Release",
        description: "It goes back on sale.",
      },
      {
        status: "recalled",
        label: "Recall",
        description: "The supplier or maker has recalled it. It can no longer be sold.",
        destructive: true,
      },
    ];
  }
  return [];
}

/** One batch: its dates and quantities, its movements, and pulling it from sale. */
export function BatchSheet({
  batch,
  missing,
  onClose,
}: {
  batch: Batch | null;
  /** The URL names a batch that isn't in the loaded list. */
  missing: boolean;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const setStatus = useSetBatchStatus();
  const [confirming, setConfirming] = useState<StatusChange | null>(null);

  const changes = batch && can("batch:manage") ? statusChanges(batch) : [];

  return (
    <>
      <DetailSheet
        open={!!batch || missing}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Batch"
        title={batch?.batch_number}
        description={batch?.variant?.product?.name ?? batch?.variant?.name ?? undefined}
        status={
          batch && (
            <>
              <StatusBadge status={batch.status} />
              {batch.expired && <Badge variant="destructive">Expired</Badge>}
            </>
          )
        }
        error={missing ? new Error("not found") : null}
        what="this batch"
        onRetry={onClose}
        actions={
          changes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {changes.map((change) => (
                <Button
                  key={change.status}
                  size="sm"
                  variant={change.destructive ? "destructive" : "outline"}
                  onClick={() => setConfirming(change)}
                >
                  {change.label}
                </Button>
              ))}
            </div>
          )
        }
      >
        {batch && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                { label: "Remaining", value: formatQuantity(batch.remaining_quantity) },
                { label: "Received", value: formatQuantity(batch.received_quantity) },
                { label: "Unit cost", value: formatMoney(batch.unit_cost, currency) },
                { label: "Made", value: formatDate(batch.manufactured_on) },
                {
                  label: "Expires",
                  value:
                    batch.days_until_expiry != null && !batch.expired
                      ? `${formatDate(batch.expires_on)} (${batch.days_until_expiry} days)`
                      : formatDate(batch.expires_on),
                },
                { label: "Can be sold", value: batch.sellable ? "Yes" : "No" },
              ]}
            />
            {batch.note && <p className="rounded-lg bg-muted/40 p-3 text-sm">{batch.note}</p>}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Movements</h3>
              <BatchMoves batchId={batch.id} />
            </div>
          </div>
        )}
      </DetailSheet>

      {batch && confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`${confirming.label} batch ${batch.batch_number}?`}
          description={confirming.description}
          confirmLabel={confirming.label}
          destructive={confirming.destructive}
          loading={setStatus.isPending}
          onConfirm={async () => {
            try {
              await setStatus.mutateAsync([batch.id, confirming.status]);
              toast.success(
                `Batch ${batch.batch_number} ${humanize(confirming.status).toLowerCase()}`,
              );
              setConfirming(null);
            } catch {
              // Toasted by the hook.
            }
          }}
        />
      )}
    </>
  );
}

function BatchMoves({ batchId }: { batchId: string }) {
  const { rows, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useStockMoves({ batch_id: batchId });

  const columns: DataTableColumn<StockMove>[] = [
    {
      key: "kind",
      header: "Move",
      render: (move) => (
        <div>
          <p>{humanize(move.kind)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(move.occurred_at)}</p>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Change",
      align: "end",
      render: (move) => formatSigned(move.quantity),
    },
  ];

  return (
    <DataTable
      embedded
      columns={columns}
      rows={rows}
      rowKey={(move) => move.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
      empty={<p className="p-6 text-center text-sm text-muted-foreground">No movements yet.</p>}
      mobileCardTitle={(move) => humanize(move.kind)}
      mobileCardFields={[
        { key: "qty", label: "Change", render: (move) => formatSigned(move.quantity) },
      ]}
    />
  );
}
