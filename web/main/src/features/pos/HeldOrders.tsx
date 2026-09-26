"use client";

import { Clock, Loader2, PauseCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useCancelOrder,
  useHeldOrders,
  useParkBasket,
  useResumeOrder,
} from "@/hooks/queries/useOrders";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CheckoutLine } from "@/types/api/sales";
import type { Order } from "@/types/api/orders";

/**
 * Sets the basket aside as a held order, so the next customer can be
 * served. The basket clears once it's safely parked.
 */
export function ParkBasketButton({
  lines,
  branchId,
  registerId,
  customerId,
  onParked,
}: {
  lines: CheckoutLine[];
  branchId: string;
  registerId: string;
  customerId?: string | null;
  onParked: () => void;
}) {
  const park = useParkBasket();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PauseCircle className="size-4" />
        Park
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Park this basket</DialogTitle>
            <DialogDescription>It waits under Held until you come back to it.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="park-label">Name it</Label>
            <Input
              id="park-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Lady in the blue shawl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={park.isPending}
              onClick={async () => {
                try {
                  await park.mutateAsync([
                    {
                      branch_id: branchId,
                      register_id: registerId,
                      customer_id: customerId,
                      label: label.trim() || null,
                      items: lines.map((line) => ({
                        variant_id: line.variant_id,
                        quantity: line.quantity,
                      })),
                    },
                  ]);
                  toast.success("Basket parked");
                  setOpen(false);
                  setLabel("");
                  onParked();
                } catch {
                  // Toasted by the hook; the basket stays as it was.
                }
              }}
            >
              {park.isPending && <Loader2 className="size-4 animate-spin" />}
              Park basket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Tickets set aside at the till: pick one back up to take payment, or drop it. */
export function HeldOrdersButton({ currency }: { currency: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const { data } = useHeldOrders();
  const resume = useResumeOrder();
  const cancel = useCancelOrder();
  const [dropping, setDropping] = useState<Order | null>(null);
  const held = data ?? [];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Clock className="size-4" />
        Held
        {held.length > 0 && <Badge variant="secondary">{held.length}</Badge>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Held baskets</SheetTitle>
            <SheetDescription>Pick one up to take payment.</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col divide-y divide-border overflow-y-auto px-4">
            {held.map((order) => (
              <li key={order.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.label ?? order.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.number} · {formatDateTime(order.opened_at)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(order.total, currency)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={resume.isPending}
                    onClick={async () => {
                      try {
                        await resume.mutateAsync([order.id]);
                        setOpen(false);
                        router.push(`/pos?order=${order.id}`);
                      } catch {
                        // Toasted by the hook.
                      }
                    }}
                  >
                    Take payment
                  </Button>
                  {can("order:cancel") && (
                    <Button size="sm" variant="ghost" onClick={() => setDropping(order)}>
                      Drop
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {held.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">Nothing held.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
      <ReasonDialog
        open={!!dropping}
        onOpenChange={(next) => !next && setDropping(null)}
        title={`Drop ${dropping?.label ?? dropping?.number}?`}
        description="The basket is cancelled. Nothing was paid, so nothing is refunded."
        placeholder="Customer left"
        confirmLabel="Drop basket"
        destructive
        onSubmit={async (reason) => {
          await cancel.mutateAsync([dropping!.id, reason]);
          toast.success("Basket dropped");
          setDropping(null);
        }}
      />
    </>
  );
}
