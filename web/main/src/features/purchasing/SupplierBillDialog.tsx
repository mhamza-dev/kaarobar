"use client";

import { Form, Formik } from "formik";
import { FilePlus2, Loader2 } from "lucide-react";
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
import { useCreateSupplierBill, useSuppliers } from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { todayIso } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { GoodsReceipt, SupplierBill } from "@/types/api/purchasing";

import { CostLinesEditor, filledLines, type CostLine } from "./CostLinesEditor";

const schema = Yup.object({
  supplier_id: Yup.string().required("Pick the supplier who sent the bill"),
  issued_on: Yup.string().required("Enter the bill's date"),
});

/** A receipt's accepted goods, as bill lines — what the supplier should be charging for. */
function linesFromReceipt(receipt: GoodsReceipt): CostLine[] {
  return (receipt.items ?? [])
    .filter((item) => item.variant_id && Number(item.accepted_quantity) > 0)
    .map((item) => ({
      variant_id: item.variant_id!,
      label: item.variant?.product?.name ?? item.variant?.name ?? "Item",
      quantity: item.accepted_quantity,
      unit_cost: item.unit_cost ?? "0",
    }));
}

/**
 * Enters a supplier's invoice as a draft bill.
 *
 * From a posted goods receipt, the lines start as what was accepted at the
 * cost it was received at — the person entering the bill then only has to
 * correct what the invoice says differently. The due date is left to the
 * backend, which works it out from the supplier's payment terms.
 */
export function SupplierBillDialog({ fromReceipt }: { fromReceipt?: GoodsReceipt }) {
  const router = useRouter();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: suppliers } = useSuppliers({ active: true });
  const createBill = useCreateSupplierBill();

  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CostLine[]>([]);

  const openDialog = () => {
    setLines(fromReceipt ? linesFromReceipt(fromReceipt) : []);
    setOpen(true);
  };

  return (
    <>
      <Button variant={fromReceipt ? "outline" : "default"} onClick={openDialog}>
        <FilePlus2 className="size-4" />
        {fromReceipt ? "Enter bill" : "New bill"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {fromReceipt ? `Bill for ${fromReceipt.number}` : "New supplier bill"}
            </DialogTitle>
            <DialogDescription>
              Saved as a draft. Posting it adds the amount to what you owe the supplier.
            </DialogDescription>
          </DialogHeader>

          <Formik
            initialValues={{
              supplier_id: fromReceipt?.supplier_id ?? "",
              supplier_invoice_number: fromReceipt?.supplier_reference ?? "",
              issued_on: todayIso(),
              due_on: "",
              notes: "",
            }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              const filled = filledLines(lines);
              if (filled.length === 0) {
                toast.error("Add at least one line to the bill");
                return;
              }

              try {
                const bill = (await createBill.mutateAsync([
                  {
                    supplier_id: values.supplier_id,
                    goods_receipt_id: fromReceipt?.id ?? null,
                    supplier_invoice_number: values.supplier_invoice_number || null,
                    issued_on: values.issued_on,
                    due_on: values.due_on || null,
                    notes: values.notes || null,
                    items: filled.map((line) => ({
                      variant_id: line.variant_id,
                      description: line.label,
                      quantity: line.quantity,
                      unit_cost: line.unit_cost,
                    })),
                  },
                ])) as SupplierBill;

                toast.success(`Bill ${bill.number} saved as a draft`);
                setOpen(false);
                router.push(`/supplier-bills/${bill.id}`);
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
                    disabled={!!fromReceipt}
                    options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <FormTextField name="supplier_invoice_number" label="Their invoice number" />
                  <FormDatePicker name="issued_on" label="Bill date" />
                  <FormDatePicker
                    name="due_on"
                    label="Due"
                    hint="Leave blank to use the supplier's terms."
                  />
                </div>

                <CostLinesEditor
                  lines={lines}
                  onChange={setLines}
                  currency={currency}
                  label="Lines"
                />

                <FormTextareaField name="notes" label="Notes" rows={2} />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Save draft bill
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
