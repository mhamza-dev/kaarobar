"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
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
import { useProductsList } from "@/hooks/queries/useProducts";
import { usePutSupplierProduct } from "@/hooks/queries/usePurchasing";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { SupplierProduct } from "@/types/api/purchasing";

const schema = Yup.object({
  variant_id: Yup.string().required("Pick a product"),
  unit_cost: Yup.number()
    .typeError("Enter their price")
    .min(0, "A price can't be negative")
    .required("Enter their price"),
  minimum_order_quantity: Yup.number().typeError("Enter a number").positive(),
  lead_time_days: Yup.number().typeError("Enter a number of days").integer().min(0),
});

/**
 * What one supplier charges for one product. The backend upserts by
 * product, so the same form adds a new line or corrects an existing price.
 */
export function SupplierProductDialog({
  open,
  onOpenChange,
  supplierId,
  editing,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  editing?: SupplierProduct | null;
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const { rows: products, isFetching } = useProductsList({ q: debounced || undefined });
  const put = usePutSupplierProduct();

  const options = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      value: variant.id,
      label:
        (product.variants?.length ?? 0) > 1 ? `${product.name} — ${variant.name}` : product.name,
      description: variant.sku ?? undefined,
    })),
  );
  // The product being edited may not be in the current search results.
  if (editing?.variant && !options.some((option) => option.value === editing.variant_id)) {
    options.unshift({
      value: editing.variant_id,
      label: editing.variant.product?.name ?? editing.variant.name ?? "Product",
      description: editing.variant.sku ?? undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Update supplier price" : "Add a product they supply"}
          </DialogTitle>
          <DialogDescription>
            Their price and terms for this product — used when you raise purchase orders.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            variant_id: editing?.variant_id ?? "",
            unit_cost: editing?.unit_cost ?? "",
            supplier_sku: editing?.supplier_sku ?? "",
            minimum_order_quantity: editing?.minimum_order_quantity ?? "",
            lead_time_days: editing?.lead_time_days?.toString() ?? "",
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            try {
              await put.mutateAsync([
                supplierId,
                {
                  variant_id: values.variant_id,
                  unit_cost: String(values.unit_cost),
                  supplier_sku: values.supplier_sku || null,
                  minimum_order_quantity: values.minimum_order_quantity
                    ? String(values.minimum_order_quantity)
                    : null,
                  lead_time_days: values.lead_time_days ? Number(values.lead_time_days) : null,
                },
              ]);
              toast.success(editing ? "Price updated" : "Product added");
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
              <FormSearchSelectField
                name="variant_id"
                label="Product"
                placeholder="Pick a product"
                searchPlaceholder="Search the catalog…"
                options={options}
                onSearchChange={setSearch}
                loading={isFetching}
                disabled={!!editing}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormNumberField name="unit_cost" label="Their price" min={0} suffix={currency} />
                <FormTextField name="supplier_sku" label="Their code" />
                <FormNumberField name="minimum_order_quantity" label="Minimum order" min={0} />
                <FormNumberField name="lead_time_days" label="Lead time" min={0} suffix="days" />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save price" : "Add product"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
