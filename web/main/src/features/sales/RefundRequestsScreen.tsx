"use client";

import Link from "next/link";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import {
  useApproveRefundRequest,
  useRefundRequest,
  useRefundRequests,
  useRefundSale,
  useRejectRefundRequest,
  useSale,
} from "@/hooks/queries/useSales";
import { usePermission } from "@/hooks/usePermission";
import { useSheetParam } from "@/hooks/useSheetParam";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatMoney, formatQuantity, humanize } from "@/lib/format";
import type { RefundRequest } from "@/types/api/sales";

const STATUS_OPTIONS = ["pending", "approved", "rejected", "completed"].map((value) => ({
  value,
  label: humanize(value),
}));

/**
 * The refund queue: what cashiers have asked to give back, for a
 * supervisor to approve or turn down — and, once approved, to pay out.
 */
export function RefundRequestsScreen() {
  const sheet = useSheetParam();
  const { data, isLoading, error, refetch } = useRefundRequests();

  const columns: DataTableColumn<RefundRequest>[] = [
    {
      key: "number",
      header: "Request",
      render: (request) => (
        <div>
          <p className="font-medium">{request.number}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(request.requested_at)}</p>
        </div>
      ),
    },
    { key: "sale", header: "Sale", render: (request) => request.sale?.number ?? "—" },
    { key: "reason", header: "Reason", render: (request) => request.reason ?? "—" },
    {
      key: "by",
      header: "Asked by",
      render: (request) => request.requested_by?.name ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (request) => <StatusBadge status={request.status} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(request) => request.id}
        onRowClick={(request) => sheet.open(request.id)}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        filters={[
          {
            id: "status",
            label: "Status",
            type: "select",
            options: STATUS_OPTIONS,
            getValue: (request) => request.status,
          },
        ]}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No refund requests. They appear here when a cashier asks to refund a sale.
          </p>
        }
        mobileCardTitle={(request) => request.number}
        mobileCardSubtitle={(request) => request.sale?.number ?? ""}
        mobileCardFields={[
          { key: "status", label: "Status", render: (request) => humanize(request.status) },
        ]}
      />
      <RefundRequestSheet requestId={sheet.value} onClose={sheet.close} />
    </>
  );
}

function RefundRequestSheet({
  requestId,
  onClose,
}: {
  requestId: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const { data: request, isLoading, error, refetch } = useRefundRequest(requestId);
  // The request lists sale-line ids; the sale has their names and prices.
  const { data: sale } = useSale(request?.sale_id);
  const approve = useApproveRefundRequest();
  const reject = useRejectRefundRequest();
  const refund = useRefundSale();
  const [rejecting, setRejecting] = useState(false);

  const canApprove = can("sale:refund_approve");
  const saleItems = new Map((sale?.items ?? []).map((item) => [item.id, item]));
  const currency = request?.sale?.currency ?? sale?.currency ?? "PKR";

  const estimate = (request?.items ?? []).reduce((total, line) => {
    const item = saleItems.get(line.sale_item_id);
    if (!item) return total;
    return (
      total + (Number(line.quantity) * Number(item.line_total ?? 0)) / Number(item.quantity || 1)
    );
  }, 0);

  const actions: WorkflowAction[] = request
    ? [
        {
          key: "approve",
          label: "Approve",
          variant: "default",
          available: request.status === "pending",
          permitted: canApprove,
          pending: approve.isPending,
          onAction: async () => {
            await approve.mutateAsync([request.id]);
            toast.success(`${request.number} approved`);
          },
        },
        {
          key: "reject",
          label: "Reject",
          variant: "outline",
          available: request.status === "pending",
          permitted: canApprove,
          onAction: () => setRejecting(true),
        },
        {
          key: "pay",
          label: "Pay out refund",
          variant: "destructive",
          available: request.status === "approved",
          permitted: canApprove,
          pending: refund.isPending,
          confirm: {
            title: `Pay out ${request.number}?`,
            description: `About ${formatMoney(estimate.toFixed(2), currency)} goes back the way the customer paid, and restocked items return to stock.`,
            confirmLabel: "Pay out",
            destructive: true,
          },
          onAction: async () => {
            await refund.mutateAsync([
              request.sale_id,
              {
                refund_request_id: request.id,
                reason: request.reason ?? undefined,
                items: (request.items ?? []).map((line) => ({
                  sale_item_id: line.sale_item_id,
                  quantity: line.quantity,
                  restock: line.restock,
                })),
              },
            ]);
            toast.success("Refund paid out");
          },
        },
      ]
    : [];

  return (
    <>
      <DetailSheet
        open={!!requestId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Refund request"
        title={request?.number}
        status={request && <StatusBadge status={request.status} />}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this refund request"
        actions={<WorkflowActions actions={actions} />}
      >
        {request && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                {
                  label: "Sale",
                  value: (
                    <Link
                      href={`/sales/${request.sale_id}`}
                      className="text-brand-primary underline-offset-2 hover:underline"
                    >
                      {request.sale?.number ?? "View sale"}
                    </Link>
                  ),
                },
                { label: "Reason", value: request.reason },
                { label: "Asked by", value: request.requested_by?.name },
                { label: "Asked", value: formatDateTime(request.requested_at) },
                {
                  label: "Reviewed by",
                  value: request.reviewed_by?.name,
                  hidden: !request.reviewed_at,
                },
                { label: "Note", value: request.review_note, hidden: !request.review_note },
                {
                  label: "About",
                  value: (
                    <span className="font-semibold">
                      {formatMoney(estimate.toFixed(2), currency)}
                    </span>
                  ),
                  hidden: estimate === 0,
                },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Items</h3>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {(request.items ?? []).map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-2 p-2">
                    <span>{saleItems.get(line.sale_item_id)?.name ?? "Item"}</span>
                    <span className="text-muted-foreground">
                      ×{formatQuantity(line.quantity)}
                      {!line.restock && " · written off"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DetailSheet>

      {request && (
        <ReasonDialog
          open={rejecting}
          onOpenChange={setRejecting}
          title={`Reject ${request.number}?`}
          description="The customer will ask why, and the next person may have to answer."
          label="Why not"
          confirmLabel="Reject"
          destructive
          onSubmit={async (note) => {
            await reject.mutateAsync([request.id, note]);
            toast.success(`${request.number} rejected`);
            setRejecting(false);
          }}
        />
      )}
    </>
  );
}
