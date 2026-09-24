"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
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
import {
  useCreateCustomer,
  useCustomerGroups,
  useUpdateCustomer,
} from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Customer, CustomerPayload } from "@/types/api/crm";

const schema = Yup.object({
  name: Yup.string().trim().required("Customer name is required"),
  email: Yup.string().email("Enter a valid email address"),
  credit_limit: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .min(0, "A credit limit can't be negative"),
});

/**
 * Create or edit a customer.
 *
 * The group is offered on create only: `SalesSerializers.customer/1` does
 * not send `customer_group_id` back, so an edit form could not show the
 * current group — and saving a blank one would silently move the customer
 * out of theirs.
 *
 * Credit fields sit behind `credit:limit_edit`. Deciding how much a customer
 * may owe is a different trust from knowing who they are, which is how the
 * backend splits the permissions too.
 */
export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onCreated?: (customer: Customer) => void;
}) {
  const { can } = usePermission();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const editing = !!customer;
  const canEditCredit = can("credit:limit_edit");
  const { data: groups } = useCustomerGroups(open && !editing && can("customer_group:view"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${customer?.name}` : "New customer"}</DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={{
            name: customer?.name ?? "",
            phone: customer?.phone ?? "",
            email: customer?.email ?? "",
            code: customer?.code ?? "",
            address_line1: customer?.address_line1 ?? "",
            city: customer?.city ?? "",
            tax_number: customer?.tax_number ?? "",
            date_of_birth: customer?.date_of_birth ?? "",
            notes: customer?.notes ?? "",
            customer_group_id: "",
            credit_allowed: customer?.credit_allowed ?? false,
            credit_limit: customer?.credit_limit ?? "",
            is_active: customer?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload: CustomerPayload = {
              name: values.name,
              phone: values.phone || null,
              email: values.email || null,
              code: values.code || null,
              address_line1: values.address_line1 || null,
              city: values.city || null,
              tax_number: values.tax_number || null,
              date_of_birth: values.date_of_birth || null,
              notes: values.notes || null,
              is_active: values.is_active,
            };

            if (canEditCredit) {
              payload.credit_allowed = values.credit_allowed;
              // A limit without credit is rejected by the backend
              // (validate_credit_limit_implies_credit), so it is dropped
              // along with the switch rather than sent to fail.
              payload.credit_limit =
                values.credit_allowed && values.credit_limit !== ""
                  ? String(values.credit_limit)
                  : null;
            }

            if (!editing && values.customer_group_id) {
              payload.customer_group_id = values.customer_group_id;
            }

            try {
              if (editing) {
                await updateCustomer.mutateAsync([customer!.id, payload]);
                toast.success("Customer updated");
              } else {
                const created = (await createCustomer.mutateAsync([payload])) as Customer;
                toast.success("Customer created");
                onCreated?.(created);
              }
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
          {({ isSubmitting, values }) => (
            <Form className="flex flex-col gap-4">
              <FormTextField name="name" label="Name" autoFocus />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField
                  name="phone"
                  label="Phone"
                  type="tel"
                  hint="How the till finds them again."
                />
                <FormTextField name="email" label="Email" type="email" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="address_line1" label="Address" />
                <FormTextField name="city" label="City" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="code" label="Customer code" />
                <FormTextField name="tax_number" label="Tax number" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormDatePicker name="date_of_birth" label="Date of birth" />
                {!editing && (groups?.length ?? 0) > 0 && (
                  <FormSelectField
                    name="customer_group_id"
                    label="Group"
                    placeholder="No group"
                    options={(groups ?? [])
                      .filter((group) => group.is_active)
                      .map((group) => ({ value: group.id, label: group.name }))}
                  />
                )}
              </div>

              {canEditCredit && (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <FormSwitch
                    name="credit_allowed"
                    label="Allow selling on account"
                    hint="Lets the till put a sale on this customer's balance."
                  />
                  {values.credit_allowed && (
                    <FormNumberField
                      name="credit_limit"
                      label="Credit limit"
                      min={0}
                      step={0.01}
                      hint="Leave blank for no limit."
                    />
                  )}
                </div>
              )}

              <FormTextareaField name="notes" label="Notes" rows={2} />
              {editing && <FormSwitch name="is_active" label="Active" />}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create customer"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
