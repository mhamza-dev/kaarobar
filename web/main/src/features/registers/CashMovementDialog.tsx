"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRecordCashMovement } from "@/hooks/queries/useRegisters";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { CASH_MOVEMENT_KINDS } from "@/types/api/sales";

const KIND_LABELS: Record<(typeof CASH_MOVEMENT_KINDS)[number], string> = {
  pay_in: "Pay in — cash added to the drawer",
  pay_out: "Pay out — cash taken for an expense",
  drop: "Drop — cash moved to the safe",
  float_adjustment: "Float adjustment",
};

const schema = Yup.object({
  kind: Yup.string().required("What kind of movement?"),
  amount: Yup.number()
    .typeError("Enter an amount")
    .positive("Enter an amount above zero")
    .required(),
  reason: Yup.string().trim().required("Say what it was for"),
});

/**
 * Cash in or out of an open drawer that isn't a sale. Recorded so the
 * expected cash at close still adds up — an unrecorded pay-out is a
 * variance someone gets blamed for.
 */
export function CashMovementDialog({ shiftId, currency }: { shiftId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const record = useRecordCashMovement();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Cash in / out
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a cash movement</DialogTitle>
            <DialogDescription>
              Cash added to or taken from this drawer outside a sale.
            </DialogDescription>
          </DialogHeader>
          <Formik
            initialValues={{ kind: "pay_out", amount: "", reason: "", note: "" }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              try {
                await record.mutateAsync([
                  shiftId,
                  {
                    kind: values.kind,
                    amount: String(values.amount),
                    reason: values.reason,
                    note: values.note || undefined,
                  },
                ]);
                toast.success("Cash movement recorded");
                helpers.resetForm();
                setOpen(false);
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
                <FormSelectField
                  name="kind"
                  label="Kind"
                  options={CASH_MOVEMENT_KINDS.map((kind) => ({
                    value: kind,
                    label: KIND_LABELS[kind],
                  }))}
                />
                <FormNumberField name="amount" label="Amount" min={0} suffix={currency} />
                <FormTextField
                  name="reason"
                  label="What for"
                  placeholder="e.g. Milk for the staff room"
                />
                <FormTextField name="note" label="Note" />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Record
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
