"use client";

import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCloseShift } from "@/hooks/queries/useRegisters";
import { useSessionStore } from "@/stores/sessionStore";
import { toast } from "@/hooks/useToast";
import { formatMoney } from "@/lib/format";
import { fromMinor, toMinor } from "@/lib/tender";
import { cn } from "@/lib/utils";
import type { Shift } from "@/types/api/sales";

/**
 * Closing the drawer.
 *
 * The cashier declares what they physically counted; the backend computes
 * the variance against what it expected. The expected figure is shown only
 * *after* a declaration is entered — showing it first turns counting into
 * copying, which is precisely the control a shift close exists to provide.
 */
export function CloseShiftDialog({
  shift,
  onOpenChange,
}: {
  shift: Shift | null;
  onOpenChange: (open: boolean) => void;
}) {
  const closeShift = useCloseShift();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [declared, setDeclared] = useState("");
  const [notes, setNotes] = useState("");

  const declaredEntered = declared.trim() !== "";
  const variance = declaredEntered ? toMinor(declared) - toMinor(shift?.expected_cash ?? "0") : 0;

  return (
    <Dialog open={!!shift} onOpenChange={onOpenChange}>
      {shift && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {shift.number}</DialogTitle>
            <DialogDescription>
              Count the drawer and enter the total. {shift.sales_count} sales this shift.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="declared-cash">Cash counted</Label>
              <Input
                id="declared-cash"
                inputMode="decimal"
                autoFocus
                value={declared}
                placeholder="0.00"
                onChange={(event) => setDeclared(event.target.value)}
              />
            </div>

            {declaredEntered && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="tabular-nums">{formatMoney(shift.expected_cash, currency)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Variance</span>
                  <span className={cn("tabular-nums", variance !== 0 && "text-destructive")}>
                    {formatMoney(fromMinor(variance), currency)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="close-notes">Notes</Label>
              <Textarea
                id="close-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything that explains a difference"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!declaredEntered || closeShift.isPending}
              onClick={async () => {
                try {
                  await closeShift.mutateAsync([
                    shift.id,
                    { declared_cash: declared, notes: notes || undefined },
                  ]);
                  toast.success("Shift closed");
                  onOpenChange(false);
                  setDeclared("");
                  setNotes("");
                } catch {
                  // Toasted by the hook.
                }
              }}
            >
              {closeShift.isPending && <Loader2 className="size-4 animate-spin" />}
              Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
