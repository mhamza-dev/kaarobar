"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdjustStock, useWriteOffStock } from "@/hooks/queries/useInventory";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatQuantity } from "@/lib/format";
import type { StockItem } from "@/types/api/inventory";

export type StockAdjustMode = "adjust" | "write_off";

const schema = Yup.object({
  quantity: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .required("Enter a quantity")
    .notOneOf([0], "Zero would change nothing"),
  reason: Yup.string().trim().required("A reason is required"),
});

/**
 * Adjust or write off stock — one dialog, two modes.
 *
 * They share a form because they take the same fields, but they are
 * genuinely different events: an adjustment is signed (a recount can go
 * either way), while a write-off always removes and is sent as a positive
 * amount lost. The backend records different move kinds and different audit
 * entries, which is what lets the valuation report separate "we miscounted"
 * from "it broke".
 *
 * A reason is mandatory in both — the backend refuses without one
 * (`Inventory.require_reason/1`), because stock that changes silently is
 * indistinguishable from shrinkage.
 */
export function StockAdjustDialog({
  item,
  mode,
  onOpenChange,
}: {
  item: StockItem | null;
  mode: StockAdjustMode;
  onOpenChange: (open: boolean) => void;
}) {
  const adjust = useAdjustStock();
  const writeOff = useWriteOffStock();
  const isWriteOff = mode === "write_off";
  const pending = adjust.isPending || writeOff.isPending;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isWriteOff ? "Write off stock" : "Adjust stock"} —{" "}
              {item.variant?.name ?? item.variant?.sku ?? "item"}
            </DialogTitle>
            <DialogDescription>
              {item.branch?.name} currently holds {formatQuantity(item.on_hand)}.{" "}
              {isWriteOff
                ? "Enter how much was lost, broken or expired."
                : "Enter the change — negative to reduce, positive to increase."}
            </DialogDescription>
          </DialogHeader>

          <Formik
            initialValues={{ quantity: "", reason: "", note: "" }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              const payload = {
                variant_id: item.variant_id,
                branch_id: item.branch_id,
                // A write-off is always a loss; the endpoint takes the amount
                // gone, not a signed delta.
                quantity: isWriteOff
                  ? String(Math.abs(Number(values.quantity)))
                  : String(values.quantity),
                reason: values.reason,
                note: values.note || undefined,
              };

              try {
                if (isWriteOff) await writeOff.mutateAsync([payload]);
                else await adjust.mutateAsync([payload]);

                toast.success(isWriteOff ? "Stock written off" : "Stock adjusted");
                onOpenChange(false);
              } catch (error) {
                const { unmapped } = applyApiFieldErrors({
                  error,
                  values,
                  setErrors: helpers.setErrors,
                });
                for (const message of unmapped) toast.error(message);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="flex flex-col gap-4">
                <FormNumberField
                  name="quantity"
                  label={isWriteOff ? "Quantity lost" : "Change in quantity"}
                  step={1}
                  autoFocus
                />
                <FormTextField
                  name="reason"
                  label="Reason"
                  hint={
                    isWriteOff
                      ? "e.g. Expired, Damaged in transit."
                      : "e.g. Recount after stocktake."
                  }
                />
                <FormTextareaField name="note" label="Note" rows={2} />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant={isWriteOff ? "destructive" : "default"}
                    disabled={isSubmitting || pending}
                  >
                    {(isSubmitting || pending) && <Loader2 className="size-4 animate-spin" />}
                    {isWriteOff ? "Write off" : "Adjust"}
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        </DialogContent>
      )}
    </Dialog>
  );
}
