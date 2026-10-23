"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuditLog } from "@/hooks/queries/useAudit";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime, humanize } from "@/lib/format";
import type { AuditEntry } from "@/types/api/audit";

/** "sale.voided" → "Sale voided". */
function describeAction(action: string) {
  return humanize(action.replace(/\./g, " "));
}

/**
 * Who did what, when — every sensitive change the backend records. Filters
 * go to the server: the trail is far too long to search on the page.
 */
export function AuditLog() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<AuditEntry | null>(null);

  const filters = {
    action: useDebounce(action, 300).trim() || undefined,
    entity_type: useDebounce(entityType, 300).trim() || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };
  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useAuditLog(filters);

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: "when",
      header: "When",
      render: (entry) => (
        <span className="whitespace-nowrap">{formatDateTime(entry.occurred_at)}</span>
      ),
    },
    {
      key: "who",
      header: "Who",
      render: (entry) => entry.actor.label ?? humanize(entry.actor.type ?? "system"),
    },
    {
      key: "what",
      header: "What",
      render: (entry) => (
        <div>
          <p className="font-medium">{describeAction(entry.action)}</p>
          {(entry.summary || entry.entity_label) && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {entry.summary ?? entry.entity_label}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            id="audit-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="sale, stock_transfer…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-entity">About</Label>
          <Input
            id="audit-entity"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            placeholder="sale, membership…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(entry) => entry.id}
        onRowClick={setViewing}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        empty={<EmptyState size="sm" title={<>Nothing recorded for these filters.</>} />}
        mobileCardTitle={(entry) => describeAction(entry.action)}
        mobileCardSubtitle={(entry) => formatDateTime(entry.occurred_at)}
        mobileCardFields={[
          { key: "who", label: "Who", render: (entry) => entry.actor.label ?? "System" },
        ]}
      />
      <DetailSheet
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        eyebrow="Audit entry"
        title={viewing ? describeAction(viewing.action) : undefined}
        description={viewing ? formatDateTime(viewing.occurred_at) : undefined}
      >
        {viewing && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                {
                  label: "Who",
                  value: viewing.actor.label ?? humanize(viewing.actor.type ?? "system"),
                },
                { label: "What", value: viewing.summary, hidden: !viewing.summary },
                {
                  label: "About",
                  value: [
                    viewing.entity_type && humanize(viewing.entity_type),
                    viewing.entity_label,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  hidden: !viewing.entity_type,
                },
                { label: "From", value: viewing.ip_address, hidden: !viewing.ip_address },
                {
                  label: "Request",
                  value: <code className="text-xs">{viewing.request_id}</code>,
                  hidden: !viewing.request_id,
                },
              ]}
            />
            {viewing.changes && Object.keys(viewing.changes).length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Changes</h3>
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
                  {JSON.stringify(viewing.changes, null, 2)}
                </pre>
              </section>
            )}
            {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Details</h3>
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
                  {JSON.stringify(viewing.metadata, null, 2)}
                </pre>
              </section>
            )}
          </div>
        )}
      </DetailSheet>
    </>
  );
}
