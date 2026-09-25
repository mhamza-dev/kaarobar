"use client";

import { Form, Formik } from "formik";
import { Banknote, Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
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
import { Input } from "@/components/ui/input";
import {
  useRecordSupplierPayment,
  useSupplierBills,
  useSuppliers,
} from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatMoney, humanize, todayIso } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import {
  SUPPLIER_PAYMENT_METHODS,
  type SupplierBill,
  type SupplierPayment,
} from "@/types/api/purchasing";

const schema = Yup.object({
  supplier_id: Yup.string().required("Pick who you paid"),
  amount: Yup.number()
    .typeError("Enter an amount")
    .positive("Enter an amount above zero")
    .required("Enter an amount"),
  method: Yup.string().required("How was it paid?"),
  paid_on: Yup.string().required("Enter the payment date"),
});

/** Bills a payment can go against: posted, and still owing something. */
function payable(bill: SupplierBill) {
  return ["posted", "partially_paid"].includes(bill.status) && Number(bill.outstanding) > 0;
}

/**
 * Records money paid to a supplier and, optionally, which bills it clears.
 *
 * Whatever isn't allocated stays on the supplier's account — a shop often
 * pays a round figure and matches it to invoices later, and the backend
 * treats that as a normal state rather than an error. Opened from a bill,
 * the whole outstanding amount starts allocated to that bill.
 */
export function SupplierPaymentDialog({
  supplierId,
  bill,
  trigger = "Record payment",
}: {
  supplierId?: string;
  bill?: SupplierBill;
  trigger?: string;
}) {
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState(bill?.supplier_id ?? supplierId ?? "");
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const { data: suppliers } = useSuppliers({ active: true });
  const { data: bills } = useSupplierBills({ supplier_id: supplier || undefined });
  const record = useRecordSupplierPayment();

  const fixedSupplier = bill?.supplier_id ?? supplierId;
  const openBills = supplier ? (bills ?? []).filter(payable) : [];
  const allocated = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0);

  const openDialog = () => {
    setSupplier(fixedSupplier ?? "");
    setAllocations(bill ? { [bill.id]: bill.outstanding ?? "0" } : {});
    setOpen(true);
  };

  return (
    <>
      <Button variant={bill ? "default" : "outline"} onClick={openDialog}>
        <Banknote className="size-4" />
        {trigger}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Record a supplier payment</DialogTitle>
            <DialogDescription>
              Anything you don&apos;t match to a bill stays on the supplier&apos;s account.
            </DialogDescription>
          </DialogHeader>

          <Formik
            initialValues={{
              supplier_id: fixedSupplier ?? "",
              amount: bill?.outstanding ?? "",
              method: "bank_transfer",
              paid_on: todayIso(),
              reference: "",
            }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              if (allocated > Number(values.amount) + 0.0001) {
                helpers.setFieldError(
                  "amount",
                  "The bills you've matched add up to more than this payment",
                );
                return;
              }

              const matched = Object.fromEntries(
                Object.entries(allocations).filter(([, amount]) => Number(amount) > 0),
              );

              try {
                const payment = (await record.mutateAsync([
                  {
                    supplier_id: values.supplier_id,
                    amount: String(values.amount),
                    method: values.method,
                    paid_on: values.paid_on,
                    reference: values.reference || null,
                    allocations: matched,
                  },
                ])) as SupplierPayment;

                toast.success(
                  Number(payment.unallocated_amount) > 0
                    ? `Payment ${payment.number} recorded — ${formatMoney(payment.unallocated_amount, payment.currency)} left on account`
                    : `Payment ${payment.number} recorded`,
                );
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    name="supplier_id"
                    label="Supplier"
                    disabled={!!fixedSupplier}
                    options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
                    onValueChange={(value) => {
                      setSupplier(value);
                      setAllocations({});
                    }}
                  />
                  <FormNumberField name="amount" label="Amount" min={0} suffix={fallbackCurrency} />
                  <FormSelectField
                    name="method"
                    label="Paid by"
                    options={SUPPLIER_PAYMENT_METHODS.map((method) => ({
                      value: method,
                      label: humanize(method),
                    }))}
                  />
                  <FormDatePicker name="paid_on" label="Paid on" />
                </div>
                <FormTextField
                  name="reference"
                  label="Reference"
                  hint="Cheque or transfer number."
                />

                {openBills.length > 0 && (
                  <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <legend className="px-1 text-sm font-medium">Match to bills</legend>
                    {openBills.map((openBill) => (
                      <div key={openBill.id} className="flex items-center gap-3 text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{openBill.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(
                              openBill.outstanding,
                              openBill.currency ?? fallbackCurrency,
                            )}{" "}
                            outstanding · due {formatDate(openBill.due_on)}
                          </p>
                        </div>
                        <Input
                          value={allocations[openBill.id] ?? ""}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`Amount towards ${openBill.number}`}
                          className="w-28 text-right"
                          onChange={(event) =>
                            setAllocations((current) => ({
                              ...current,
                              [openBill.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </fieldset>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
    </>
  );
}
