"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBatches, useExpiringBatches } from "@/hooks/queries/useInventory";
import { useSheetParam } from "@/hooks/useSheetParam";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Batch } from "@/types/api/inventory";

import { BatchSheet } from "./BatchSheet";

/**
 * Batches and expiry — the screen a pharmacy or grocer checks each morning.
 *
 * "Expiring soon" is a separate backend endpoint rather than a client-side
 * filter over this list, because what counts as soon is a stock question
 * (what is still on the shelf), not a display one.
 */
export function BatchesTable() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [expiringOnly, setExpiringOnly] = useState(false);

  const all = useBatches();
  const expiring = useExpiringBatches(30);
  const source = expiringOnly ? expiring : all;
  const sheet = useSheetParam();
  // No single-batch endpoint: the sheet shows the batch from the loaded list,
  // looking in both so a link survives the "expiring" toggle.
  const open =
    sheet.value &&
    [...(all.data ?? []), ...(expiring.data ?? [])].find((b) => b.id === sheet.value);
  const listsLoaded = !all.isLoading && !expiring.isLoading;

  const columns: DataTableColumn<Batch>[] = [
    {
      key: "batch",
      header: "Batch",
      render: (batch) => (
        <div>
          <p className="font-medium">{batch.batch_number}</p>
          <p className="text-xs text-muted-foreground">
            {batch.variant?.product?.name ?? batch.variant?.name ?? ""}
          </p>
        </div>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      render: (batch) => (
        <div className="flex items-center gap-1.5">
          {formatDate(batch.expires_on)}
          {batch.expired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : batch.days_until_expiry !== null && batch.days_until_expiry <= 30 ? (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="size-3" />
              {batch.days_until_expiry}d
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "remaining",
      header: "Remaining",
      align: "end",
      render: (batch) => formatQuantity(batch.remaining_quantity),
    },
    {
      key: "received",
      header: "Received",
      align: "end",
      render: (batch) => formatQuantity(batch.received_quantity),
    },
    {
      key: "cost",
      header: "Unit cost",
      align: "end",
      render: (batch) => formatMoney(batch.unit_cost, currency),
    },
    {
      key: "status",
      header: "Status",
      render: (batch) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={batch.status} />
          {!batch.sellable && !batch.expired && <Badge variant="outline">Not sellable</Badge>}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3">
        <Button
          variant={expiringOnly ? "default" : "outline"}
          size="sm"
          aria-pressed={expiringOnly}
          onClick={() => setExpiringOnly((value) => !value)}
        >
          <AlertTriangle className="size-3.5" />
          Expiring within 30 days
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={source.data ?? []}
        rowKey={(batch) => batch.id}
        onRowClick={(batch) => sheet.open(batch.id)}
        loading={source.isLoading}
        error={source.error ? { message: source.error.message } : null}
        onRetry={() => source.refetch()}
        search={{
          getText: (batch) => `${batch.batch_number} ${batch.variant?.product?.name ?? ""}`,
        }}
        mobileCardTitle={(batch) => batch.batch_number}
        mobileCardSubtitle={(batch) => batch.variant?.product?.name ?? ""}
        mobileCardFields={[
          { key: "expires", label: "Expires", render: (batch) => formatDate(batch.expires_on) },
          {
            key: "remaining",
            label: "Remaining",
            render: (batch) => formatQuantity(batch.remaining_quantity),
          },
        ]}
      />

      <BatchSheet
        batch={open || null}
        missing={!!sheet.value && !open && listsLoaded}
        onClose={sheet.close}
      />
    </>
  );
}
