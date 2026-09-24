"use client";

import { addDays, format } from "date-fns";
import { FieldArray, Form, Formik } from "formik";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import { useCustomerSearch } from "@/hooks/queries/useCustomers";
import { useCreateQuote, useSetQuoteLines } from "@/hooks/queries/useQuotes";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Quote, QuoteLineInput } from "@/types/api/quotes";

const emptyLine = { description: "", quantity: "1", unit_price: "", discount: "" };

const lineSchema = Yup.object({
  description: Yup.string().trim().required("Describe the work"),
  quantity: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .required("How many?")
    .moreThan(0, "More than zero"),
  unit_price: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .required("Price it")
    .min(0, "Can't be negative"),
});

function toLineInputs(
  lines: Array<{ description: string; quantity: string; unit_price: string; discount: string }>,
): QuoteLineInput[] {
  return lines.map((line) => ({
    description: line.description.trim(),
    quantity: String(line.quantity),
    unit_price: String(line.unit_price),
    discount: line.discount === "" ? undefined : String(line.discount),
  }));
}

/**
 * Drawing up a quote, or re-pricing a draft's lines.
 *
 * The form never shows a total of its own: lines go to the backend, which
 * prices them (tax included) and returns the totals the customer will hold
 * the firm to. Editing an existing quote only replaces its lines — that is
 * all `PUT /quotes/:id/lines` changes, and only while it's a draft.
 */
export function QuoteForm({ quote }: { quote?: Quote }) {
  const router = useRouter();
  const create = useCreateQuote();
  const setLines = useSetQuoteLines();
  const editing = !!quote;
  const [customerQuery, setCustomerQuery] = useState("");
  const customers = useCustomerSearch(useDebounce(customerQuery, 300), !editing);

  return (
    <Formik
      initialValues={{
        customer_id: quote?.customer_id ?? "",
        title: quote?.title ?? "",
        valid_until: quote?.valid_until ?? format(addDays(new Date(), 14), "yyyy-MM-dd"),
        notes: quote?.notes ?? "",
        terms: quote?.terms ?? "",
        lines: quote?.lines?.length
          ? quote.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price ?? "",
              discount: line.discount && Number(line.discount) > 0 ? line.discount : "",
            }))
          : [emptyLine],
      }}
      validationSchema={Yup.object({
        // `Quote.changeset/2` requires a title; editing only touches lines.
        title: editing ? Yup.string() : Yup.string().trim().required("Give the quote a title"),
        lines: Yup.array().of(lineSchema).min(1, "A quote needs at least one line"),
      })}
      onSubmit={async (values, helpers) => {
        try {
          if (editing) {
            await setLines.mutateAsync([quote!.id, toLineInputs(values.lines)]);
            toast.success("Lines updated");
            router.push(`/quotes/${quote!.id}`);
          } else {
            const created = await create.mutateAsync([
              {
                customer_id: values.customer_id || undefined,
                title: values.title || undefined,
                valid_until: values.valid_until || undefined,
                notes: values.notes || undefined,
                terms: values.terms || undefined,
                lines: toLineInputs(values.lines),
              },
            ]);
            toast.success(`Quote ${created.number} drafted`);
            router.push(`/quotes/${created.id}`);
          }
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
          {!editing && (
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSearchSelectField
                  name="customer_id"
                  label="Customer"
                  placeholder="Pick a customer"
                  searchPlaceholder="Search name or phone…"
                  options={(customers.data ?? []).map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                    description: customer.phone ?? undefined,
                  }))}
                  onSearchChange={setCustomerQuery}
                  loading={customers.isFetching}
                />
                <FormDatePicker name="valid_until" label="Valid until" />
              </div>
              <FormTextField name="title" label="Title" placeholder="Office rewiring — phase 1" />
            </section>
          )}

          <FieldArray name="lines">
            {({ push, remove }) => (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Lines</h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => push(emptyLine)}>
                    <Plus className="size-4" />
                    Add line
                  </Button>
                </div>
                {typeof errors.lines === "string" && (
                  <p className="text-xs text-destructive">{errors.lines}</p>
                )}
                {values.lines.map((_, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <FormTextField
                      name={`lines.${index}.description`}
                      label="Description"
                      className="min-w-48 flex-1"
                    />
                    <FormNumberField
                      name={`lines.${index}.quantity`}
                      label="Qty"
                      min={0}
                      className="w-20"
                    />
                    <FormNumberField
                      name={`lines.${index}.unit_price`}
                      label="Unit price"
                      min={0}
                      step={0.01}
                      className="w-28"
                    />
                    <FormNumberField
                      name={`lines.${index}.discount`}
                      label="Discount"
                      min={0}
                      step={0.01}
                      className="w-28"
                    />
                    {values.lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6"
                        aria-label={`Remove line ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Totals and tax are worked out when you save.
                </p>
              </section>
            )}
          </FieldArray>

          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextareaField name="notes" label="Notes for the customer" rows={3} />
              <FormTextareaField name="terms" label="Terms" rows={3} />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save lines" : "Save draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(editing ? `/quotes/${quote!.id}` : "/quotes")}
            >
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
