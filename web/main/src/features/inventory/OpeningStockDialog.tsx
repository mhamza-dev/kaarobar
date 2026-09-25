"use client";

import { Form, Formik } from "formik";
import { Loader2, PackagePlus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useSetOpeningStock } from "@/hooks/queries/useInventory";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { useSessionStore } from "@/stores/sessionStore";

const schema = Yup.object({
  variant_id: Yup.string().required("Pick a product"),
  branch_id: Yup.string().required("Pick a branch"),
  quantity: Yup.number().typeError("Enter a quantity").positive("Enter more than zero").required(),
  unit_cost: Yup.number().typeError("Enter what it cost").min(0).required("Enter what it cost"),
});

/**
 * Records stock a business already had before it started using Kaarobar.
 * Its own move kind ("opening"), so the valuation report can tell stock
 * that was bought through the system from stock that was brought into it.
 */
export function OpeningStockDialog() {
  const scope = useSessionStore((state) => state.scope);
  const currency = scope?.business?.currency ?? "PKR";
  const { data: branches } = useBranchesList();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const { rows: products, isFetching } = useProductsList({ q: debounced || undefined });
  const setOpening = useSetOpeningStock();

  const options = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      value: variant.id,
      label:
        (product.variants?.length ?? 0) > 1 ? `${product.name} — ${variant.name}` : product.name,
      description: variant.sku ?? undefined,
    })),
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PackagePlus className="size-4" />
        Opening stock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record opening stock</DialogTitle>
            <DialogDescription>
              Stock you already had before using Kaarobar, and what it cost you.
            </DialogDescription>
          </DialogHeader>

          <Formik
            initialValues={{
              variant_id: "",
              branch_id: scope?.branch?.id ?? (branches ?? []).find((b) => b.is_main)?.id ?? "",
              quantity: "",
              unit_cost: "",
            }}
            enableReinitialize
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              try {
                await setOpening.mutateAsync([
                  {
                    variant_id: values.variant_id,
                    branch_id: values.branch_id,
                    quantity: String(values.quantity),
                    unit_cost: String(values.unit_cost),
                  },
                ]);
                toast.success("Opening stock recorded");
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
                <FormSearchSelectField
                  name="variant_id"
                  label="Product"
                  placeholder="Pick a product"
                  searchPlaceholder="Search the catalog…"
                  options={options}
                  onSearchChange={setSearch}
                  loading={isFetching}
                />
                <FormSelectField
                  name="branch_id"
                  label="Branch"
                  options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormNumberField name="quantity" label="Quantity" min={0} />
                  <FormNumberField name="unit_cost" label="Cost each" min={0} suffix={currency} />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Record stock
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
