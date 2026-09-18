"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useCreatePurchaseOrder, useSuppliers } from "@/hooks/queries/usePurchasing";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseOrder } from "@/types/api/purchasing";

type Line = { variant_id: string; label: string; quantity: string; unit_cost: string };

const schema = Yup.object({
  supplier_id: Yup.string().required("Pick a supplier"),
  branch_id: Yup.string().required("Pick which branch is ordering"),
});

export function PurchaseOrderForm() {
  const router = useRouter();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: suppliers } = useSuppliers({ active: true });
  const { data: branches } = useBranchesList();
  const createOrder = useCreatePurchaseOrder();

  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { rows: products } = useProductsList({ q: debouncedSearch || undefined });

  // Presentational only — the backend computes the authoritative total from
  // the lines it receives, including tax the client doesn't model.
  const estimatedTotal = lines.reduce(
    (total, line) => total + Number(line.quantity || 0) * Number(line.unit_cost || 0),
    0,
  );

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <Formik
      initialValues={{ supplier_id: "", branch_id: "", expected_on: "", reference: "", notes: "" }}
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        if (lines.length === 0) {
          toast.error("Add at least one product to order");
          return;
        }

        try {
          const order = (await createOrder.mutateAsync([
            {
              supplier_id: values.supplier_id,
              branch_id: values.branch_id,
              expected_on: values.expected_on || null,
              reference: values.reference || null,
              notes: values.notes || null,
              items: lines.map((line) => ({
                variant_id: line.variant_id,
                ordered_quantity: line.quantity,
                unit_cost: line.unit_cost,
              })),
            },
          ])) as PurchaseOrder;

          toast.success(`Order ${order.number} created`);
          router.replace(`/purchase-orders/${order.id}`);
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
        <Form className="flex max-w-3xl flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelectField
              name="supplier_id"
              label="Supplier"
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
            <FormSelectField
              name="branch_id"
              label="Deliver to"
              options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
            />
            <FormDatePicker name="expected_on" label="Expected on" />
            <FormTextField name="reference" label="Your reference" />
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-6">
            <Label htmlFor="po-search">Add products</Label>
            <Input
              id="po-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the catalog…"
            />
            {search && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                {products.slice(0, 8).map((product) => {
                  const variant = product.variants?.[0];
                  if (!variant) return null;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        if (lines.some((line) => line.variant_id === variant.id)) return;
                        setLines((current) => [
                          ...current,
                          {
                            variant_id: variant.id,
                            label: product.name,
                            quantity: "1",
                            // Seeded from the last known cost, which is what
                            // the buyer is about to check against the invoice.
                            unit_cost: variant.cost ?? "0",
                          },
                        ]);
                        setSearch("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>{product.name}</span>
                      <Plus className="size-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              {lines.map((line, index) => (
                <div key={line.variant_id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-40 flex-1 text-sm">{line.label}</span>
                  <Input
                    value={line.quantity}
                    inputMode="decimal"
                    aria-label={`Quantity for ${line.label}`}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    className="w-24"
                  />
                  <Input
                    value={line.unit_cost}
                    inputMode="decimal"
                    aria-label={`Unit cost for ${line.label}`}
                    onChange={(event) => updateLine(index, { unit_cost: event.target.value })}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${line.label}`}
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              <div className="flex justify-end border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">Estimated total:&nbsp;</span>
                <span className="font-medium">
                  {formatMoney(estimatedTotal.toFixed(2), currency)}
                </span>
              </div>
            </div>
          )}

          <FormTextareaField name="notes" label="Notes" rows={2} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create draft order
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/purchase-orders")}>
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
