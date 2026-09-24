"use client";

import { FieldArray, Form, Formik } from "formik";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import { useCustomerSearch } from "@/hooks/queries/useCustomers";
import { useCreateServiceJob } from "@/hooks/queries/useServiceJobs";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { humanize } from "@/lib/format";
import { JOB_PRIORITIES, type ServiceJobPayload } from "@/types/api/serviceJobs";

const emptyItem = {
  description: "",
  quantity: "1",
  unit_price: "",
  tag_code: "",
  colour: "",
  brand: "",
  serial_number: "",
  condition_notes: "",
};

const schema = Yup.object({
  walk_in_name: Yup.string().when("customer_id", {
    is: (value: string) => !value,
    then: (rule) => rule.trim().required("A customer or a name"),
  }),
  items: Yup.array()
    .of(
      Yup.object({
        description: Yup.string().trim().required("What is it?"),
        quantity: Yup.number()
          .transform((value, original) => (original === "" ? undefined : value))
          .required("How many?")
          .moreThan(0, "More than zero"),
      }),
    )
    .min(1, "Take in at least one item"),
});

/**
 * Taking work in at the counter — a laundry bag, a phone for repair.
 *
 * Every item is recorded with what makes it identifiable later (tag, colour,
 * brand, serial) and its condition on arrival: the intake record is what
 * settles "it was like that when I brought it in". The quoted total is
 * summed by the backend from the item prices.
 */
export function ServiceJobForm() {
  const router = useRouter();
  const create = useCreateServiceJob();
  const [customerQuery, setCustomerQuery] = useState("");
  const customers = useCustomerSearch(useDebounce(customerQuery, 300));

  return (
    <Formik
      initialValues={{
        customer_id: "",
        walk_in_name: "",
        walk_in_phone: "",
        priority: "normal",
        promised_on: "",
        notes: "",
        items: [emptyItem],
      }}
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        const blankToUndefined = (value: string) => value.trim() || undefined;
        const payload: ServiceJobPayload = {
          customer_id: values.customer_id || undefined,
          walk_in_name: values.customer_id ? undefined : values.walk_in_name.trim(),
          walk_in_phone: values.customer_id ? undefined : blankToUndefined(values.walk_in_phone),
          priority: values.priority,
          promised_on: values.promised_on || undefined,
          notes: blankToUndefined(values.notes),
          items: values.items.map((item) => ({
            description: item.description.trim(),
            quantity: String(item.quantity),
            unit_price: item.unit_price === "" ? undefined : String(item.unit_price),
            tag_code: blankToUndefined(item.tag_code),
            colour: blankToUndefined(item.colour),
            brand: blankToUndefined(item.brand),
            serial_number: blankToUndefined(item.serial_number),
            condition_notes: blankToUndefined(item.condition_notes),
          })),
        };

        try {
          const job = await create.mutateAsync([payload]);
          toast.success(`Job ${job.number} taken in`);
          router.push(`/service-jobs/${job.id}`);
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
      {({ isSubmitting, values, errors }) => (
        <Form className="flex max-w-3xl flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <FormSearchSelectField
              name="customer_id"
              label="Customer"
              placeholder="Walk-in (no account)"
              searchPlaceholder="Search name or phone…"
              options={(customers.data ?? []).map((customer) => ({
                value: customer.id,
                label: customer.name,
                description: customer.phone ?? undefined,
              }))}
              onSearchChange={setCustomerQuery}
              loading={customers.isFetching}
            />
            {!values.customer_id && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="walk_in_name" label="Name" />
                <FormTextField name="walk_in_phone" label="Phone" type="tel" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelectField
                name="priority"
                label="Priority"
                options={JOB_PRIORITIES.map((value) => ({ value, label: humanize(value) }))}
              />
              <FormDatePicker name="promised_on" label="Promised for" />
            </div>
          </section>

          <FieldArray name="items">
            {({ push, remove }) => (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Items</h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => push(emptyItem)}>
                    <Plus className="size-4" />
                    Add item
                  </Button>
                </div>
                {typeof errors.items === "string" && (
                  <p className="text-xs text-destructive">{errors.items}</p>
                )}
                {values.items.map((_, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <FormTextField
                        name={`items.${index}.description`}
                        label="Item"
                        placeholder="Shalwar kameez, iPhone 12…"
                        className="flex-1"
                      />
                      <FormNumberField
                        name={`items.${index}.quantity`}
                        label="Qty"
                        min={0}
                        className="w-20"
                      />
                      <FormNumberField
                        name={`items.${index}.unit_price`}
                        label="Price"
                        min={0}
                        step={0.01}
                        className="w-28"
                      />
                      {values.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6"
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <FormTextField name={`items.${index}.tag_code`} label="Tag" />
                      <FormTextField name={`items.${index}.colour`} label="Colour" />
                      <FormTextField name={`items.${index}.brand`} label="Brand" />
                      <FormTextField name={`items.${index}.serial_number`} label="Serial" />
                    </div>
                    <FormTextField
                      name={`items.${index}.condition_notes`}
                      label="Condition on arrival"
                      placeholder="Small tear on left sleeve…"
                    />
                  </div>
                ))}
              </section>
            )}
          </FieldArray>

          <FormTextareaField name="notes" label="Job notes" rows={2} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Take in
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/service-jobs")}>
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
