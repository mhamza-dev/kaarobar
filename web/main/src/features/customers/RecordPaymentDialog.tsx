"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
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
import { useRecordCustomerPayment } from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, humanize } from "@/lib/format";
import { CUSTOMER_PAYMENT_METHODS, type Customer } from "@/types/api/crm";

const schema = Yup.object({
  amount: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .required("Enter the amount received")
    .moreThan(0, "The amount must be more than zero"),
  method: Yup.string().required(),
});

/**
 * Taking money against a customer's balance.
 *
 * "Settle oldest invoices first" maps to the backend's `auto_allocate`, and
 * is only offered to someone holding `credit:allocate` — deciding which
 * invoice a payment clears changes the ageing report and who gets chased
 * next, so it is a separate grant from taking the money. Without it the
 * payment sits on account, unallocated, which is always safe.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  customer,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  currency: string;
}) {
  const { can } = usePermission();
  const recordPayment = useRecordCustomerPayment();
  const canAllocate = can("credit:allocate");
  const owing = customer.owing ? customer.balance : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {owing
              ? `${customer.name} owes ${formatMoney(owing, currency)}.`
              : `${customer.name} has nothing outstanding — this will sit on their account.`}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            amount: owing ?? "",
            method: "cash",
            paid_on: "",
            reference: "",
            notes: "",
            auto_allocate: canAllocate,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            try {
              await recordPayment.mutateAsync([
                customer.id,
                {
                  amount: String(values.amount),
                  method: values.method,
                  paid_on: values.paid_on || undefined,
                  reference: values.reference || undefined,
                  notes: values.notes || undefined,
                  auto_allocate: canAllocate && values.auto_allocate ? true : undefined,
                },
              ]);
              toast.success("Payment recorded");
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
              <div className="grid gap-4 sm:grid-cols-2">
                <FormNumberField name="amount" label="Amount" min={0} step={0.01} autoFocus />
                <FormSelectField
                  name="method"
                  label="Method"
                  options={CUSTOMER_PAYMENT_METHODS.map((method) => ({
                    value: method,
                    label: humanize(method),
                  }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormDatePicker name="paid_on" label="Paid on" hint="Defaults to today." />
                <FormTextField name="reference" label="Reference" hint="Cheque or transfer no." />
              </div>
              <FormTextField name="notes" label="Notes" />
              {canAllocate && (
                <FormSwitch
                  name="auto_allocate"
                  label="Settle oldest invoices first"
                  hint="Off leaves the money on account for someone to allocate later."
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Record payment
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
