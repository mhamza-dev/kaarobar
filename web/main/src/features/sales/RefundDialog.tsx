"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useApproveRefundRequest,
  useCreateRefundRequest,
  useRefundSale,
} from "@/hooks/queries/useSales";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { RefundRequest, ReturnLine, Sale } from "@/types/api/sales";

type LineState = { quantity: string; restock: boolean };

/**
 * Taking goods back against a sale.
 *
 * Asking and approving are separate permissions — the cashier who rang the
 * sale shouldn't be the one who approves undoing it. Someone who holds both
 * (the owner of a one-person shop) refunds in one step: the request is
 * raised, approved and paid out together, so the record still shows who
 * authorised what. Everyone else sends it to the queue.
 *
 * The money figure shown is an estimate from the line totals; the backend
 * prorates each line's tax and discounts exactly.
 */
export function RefundDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: Sale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermission();
  const canApprove = can("sale:refund_approve");
  const createRequest = useCreateRefundRequest();
  const approve = useApproveRefundRequest();
  const refund = useRefundSale();

  const refundable = (sale.items ?? []).filter((item) => Number(item.refundable_quantity) > 0);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [reason, setReason] = useState("");
  const pending = createRequest.isPending || approve.isPending || refund.isPending;

  const lineFor = (id: string): LineState => lines[id] ?? { quantity: "", restock: true };
  const update = (id: string, patch: Partial<LineState>) =>
    setLines((current) => ({ ...current, [id]: { ...lineFor(id), ...patch } }));

  const chosen: ReturnLine[] = refundable
    .map((item) => ({ item, line: lineFor(item.id) }))
    .filter(({ line }) => Number(line.quantity) > 0)
    .map(({ item, line }) => ({
      sale_item_id: item.id,
      quantity: line.quantity,
      restock: line.restock,
    }));

  const estimate = refundable.reduce((total, item) => {
    const quantity = Number(lineFor(item.id).quantity || 0);
    const perUnit = Number(item.line_total ?? 0) / Number(item.quantity || 1);
    return total + quantity * perUnit;
  }, 0);

  const tooMany = refundable.find(
    (item) => Number(lineFor(item.id).quantity || 0) > Number(item.refundable_quantity),
  );

  const reset = () => {
    setLines({});
    setReason("");
  };

  const submit = async () => {
    if (chosen.length === 0) return toast.error("Enter a quantity for at least one item");
    if (tooMany)
      return toast.error(
        `Only ${formatQuantity(tooMany.refundable_quantity)} of ${tooMany.name} can be returned`,
      );
    if (!reason.trim()) return toast.error("Give a reason for the refund");

    try {
      const request = (await createRequest.mutateAsync([
        sale.id,
        { reason: reason.trim(), items: chosen },
      ])) as RefundRequest;

      if (canApprove) {
        await approve.mutateAsync([request.id]);
        await refund.mutateAsync([
          sale.id,
          { items: chosen, refund_request_id: request.id, reason: reason.trim() },
        ]);
        toast.success(`Refunded ${formatMoney(estimate.toFixed(2), sale.currency)}`);
      } else {
        toast.success(`Refund ${request.number} sent for approval`);
      }
      reset();
      onOpenChange(false);
    } catch {
      // Toasted by the hook. A request already raised stays in the queue.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Refund items from {sale.number}</DialogTitle>
          <DialogDescription>
            {canApprove
              ? "The money goes back the way it was paid, and restocked items return to the shelf."
              : "This goes to a supervisor to approve before any money is given back."}
          </DialogDescription>
        </DialogHeader>

        {refundable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everything on this sale has been refunded.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
            {refundable.map((item) => {
              const line = lineFor(item.id);
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Up to {formatQuantity(item.refundable_quantity)} ·{" "}
                      {formatMoney(item.unit_price, sale.currency)} each
                    </p>
                  </div>
                  <Input
                    value={line.quantity}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Quantity of ${item.name} to return`}
                    className="w-20 text-right"
                    onChange={(event) => update(item.id, { quantity: event.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={line.restock}
                      onCheckedChange={(checked) => update(item.id, { restock: checked === true })}
                      aria-label={`Put ${item.name} back in stock`}
                    />
                    Back to stock
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-reason">Reason</Label>
          <Textarea
            id="refund-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Damaged packaging, wrong size"
          />
        </div>

        <DialogFooter className="items-center">
          {estimate > 0 && (
            <p className="mr-auto text-sm text-muted-foreground">
              About {formatMoney(estimate.toFixed(2), sale.currency)}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={canApprove ? "destructive" : "default"}
            disabled={pending || refundable.length === 0}
            onClick={submit}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {canApprove ? "Refund now" : "Send for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
