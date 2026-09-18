"use client";

import { Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { useCreateGoodsReceipt, usePostGoodsReceipt } from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { formatQuantity } from "@/lib/format";
import type { GoodsReceipt, PurchaseOrder } from "@/types/api/purchasing";

/**
 * Receiving goods against a purchase order.
 *
 * Creates the receipt and posts it in one go — posting is what actually
 * moves stock, and a receipt left unposted is a delivery that physically
 * happened but is invisible to the shop floor. The two calls stay separate
 * in the service layer because the backend models them separately (a
 * receipt can be corrected before posting), but nothing in this flow
 * benefits from stopping in between.
 *
 * Quantities default to what is still outstanding, since that is what
 * usually turns up.
 */
export function GoodsReceiptDialog({ order }: { order: PurchaseOrder }) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const createReceipt = useCreateGoodsReceipt();
  const postReceipt = usePostGoodsReceipt();

  const items = (order.items ?? []).filter((item) => !item.fully_received);
  const pending = createReceipt.isPending || postReceipt.isPending;

  const quantityFor = (itemId: string, outstanding: string) => quantities[itemId] ?? outstanding;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PackageCheck className="size-4" />
        Receive goods
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuantities({});
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive against {order.number}</DialogTitle>
            <DialogDescription>
              Enter what actually arrived. Posting adds it to stock at {order.branch?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every line on this order has already been received.
              </p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-border pb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item.variant?.product?.name ?? item.description ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuantity(item.outstanding_quantity)} outstanding of{" "}
                      {formatQuantity(item.ordered_quantity)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`receive-${item.id}`} className="sr-only">
                      Quantity received for {item.variant?.product?.name ?? "line"}
                    </Label>
                    <Input
                      id={`receive-${item.id}`}
                      value={quantityFor(item.id, item.outstanding_quantity)}
                      inputMode="decimal"
                      className="w-24 text-right"
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || items.length === 0}
              onClick={async () => {
                const lines = items
                  .map((item) => ({
                    variant_id: item.variant_id!,
                    purchase_order_item_id: item.id,
                    quantity: quantityFor(item.id, item.outstanding_quantity),
                    unit_cost: item.unit_cost ?? "0",
                  }))
                  .filter((line) => Number(line.quantity) > 0);

                if (lines.length === 0) {
                  toast.error("Enter at least one quantity to receive");
                  return;
                }

                try {
                  const receipt = (await createReceipt.mutateAsync([
                    {
                      supplier_id: order.supplier_id,
                      branch_id: order.branch_id,
                      purchase_order_id: order.id,
                      items: lines,
                    },
                  ])) as GoodsReceipt;

                  await postReceipt.mutateAsync([receipt.id]);
                  toast.success(`Received on ${receipt.number}`);
                  setOpen(false);
                  setQuantities({});
                } catch {
                  // Toasted by the hook; the dialog stays open with the
                  // typed quantities so nothing has to be re-entered.
                }
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Receive and post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
