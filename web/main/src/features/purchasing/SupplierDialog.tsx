"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Supplier } from "@/types/api/purchasing";

const schema = Yup.object({
  name: Yup.string().trim().required("Supplier name is required"),
  email: Yup.string().email("Enter a valid email address"),
  payment_terms_days: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .min(0, "Terms can't be negative"),
});

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}) {
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const editing = !!supplier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${supplier?.name}` : "New supplier"}</DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={{
            name: supplier?.name ?? "",
            contact_name: supplier?.contact_name ?? "",
            phone: supplier?.phone ?? "",
            email: supplier?.email ?? "",
            address_line1: supplier?.address?.line1 ?? "",
            city: supplier?.address?.city ?? "",
            tax_number: supplier?.tax_number ?? "",
            payment_terms_days: supplier?.payment_terms_days?.toString() ?? "",
            notes: supplier?.notes ?? "",
            is_active: supplier?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload = {
              ...values,
              contact_name: values.contact_name || null,
              phone: values.phone || null,
              email: values.email || null,
              address_line1: values.address_line1 || null,
              city: values.city || null,
              tax_number: values.tax_number || null,
              notes: values.notes || null,
              payment_terms_days:
                values.payment_terms_days === "" ? null : Number(values.payment_terms_days),
            };

            try {
              if (editing) await updateSupplier.mutateAsync([supplier!.id, payload]);
              else await createSupplier.mutateAsync([payload]);

              toast.success(editing ? "Supplier updated" : "Supplier created");
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
              <FormTextField name="name" label="Supplier name" autoFocus />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="contact_name" label="Contact person" />
                <FormTextField name="phone" label="Phone" type="tel" />
              </div>
              <FormTextField name="email" label="Email" type="email" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="address_line1" label="Address" />
                <FormTextField name="city" label="City" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="tax_number" label="Tax number" />
                <FormNumberField
                  name="payment_terms_days"
                  label="Payment terms"
                  suffix="days"
                  min={0}
                  hint="How long you have to pay their bills."
                />
              </div>
              <FormTextareaField name="notes" label="Notes" rows={2} />
              <FormSwitch name="is_active" label="Active" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create supplier"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
