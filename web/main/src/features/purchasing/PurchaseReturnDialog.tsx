"use client";

import { Form, Formik } from "formik";
import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSelectField } from "@/components/forms/FormSelectField";
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
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useCreatePurchaseReturn, useSuppliers } from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { todayIso } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseReturn } from "@/types/api/purchasing";

import { CostLinesEditor, filledLines, type CostLine } from "./CostLinesEditor";

const schema = Yup.object({
  supplier_id: Yup.string().required("Pick the supplier you're returning to"),
  branch_id: Yup.string().required("Pick the branch the goods leave from"),
  returned_on: Yup.string().required("Enter the return date"),
  reason: Yup.string().trim().max(200, "Keep the reason under 200 characters"),
});

/**
 * Starts a return to a supplier as a draft. Nothing leaves stock until it
 * is posted, so a return can be put together while the goods are still
 * being packed.
 */
export function PurchaseReturnDialog() {
  const router = useRouter();
  const scope = useSessionStore((state) => state.scope);
  const currency = scope?.business?.currency ?? "PKR";
  const { data: suppliers } = useSuppliers({ active: true });
  const { data: branches } = useBranchesList();
  const createReturn = useCreatePurchaseReturn();

  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CostLine[]>([]);

  return (
    <>
      <Button
        onClick={() => {
          setLines([]);
          setOpen(true);
        }}
      >
        <Undo2 className="size-4" />
        New return
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return goods to a supplier</DialogTitle>
            <DialogDescription>
              Saved as a draft. Posting takes the goods out of stock and credits the supplier.
            </DialogDescription>
          </DialogHeader>

          <Formik
            initialValues={{
              supplier_id: "",
              // The branch in scope, else the main one: an owner working
              // across branches has no current branch of their own.
              branch_id: scope?.branch?.id ?? (branches ?? []).find((b) => b.is_main)?.id ?? "",
              returned_on: todayIso(),
              reason: "",
              notes: "",
            }}
            // The branch list can arrive after the form first renders.
            enableReinitialize
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              const filled = filledLines(lines);
              if (filled.length === 0) {
                toast.error("Add at least one product to return");
                return;
              }

              try {
                const record = (await createReturn.mutateAsync([
                  {
                    supplier_id: values.supplier_id,
                    branch_id: values.branch_id,
                    returned_on: values.returned_on,
                    reason: values.reason || null,
                    notes: values.notes || null,
                    items: filled.map((line) => ({
                      variant_id: line.variant_id,
                      quantity: line.quantity,
                      unit_cost: line.unit_cost,
                    })),
                  },
                ])) as PurchaseReturn;

                toast.success(`Return ${record.number} saved as a draft`);
                setOpen(false);
                router.push(`/purchase-returns/${record.id}`);
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    name="supplier_id"
                    label="Supplier"
                    options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <FormSelectField
                    name="branch_id"
                    label="From branch"
                    options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
                  />
                  <FormDatePicker name="returned_on" label="Returned on" />
                  <FormTextField name="reason" label="Reason" placeholder="Damaged, expired…" />
                </div>

                <CostLinesEditor
                  lines={lines}
                  onChange={setLines}
                  currency={currency}
                  label="Products going back"
                />

                <FormTextareaField name="notes" label="Notes" rows={2} />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Save draft return
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>
    </>
  );
}
