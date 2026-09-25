"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useCreatePurchaseOrder, useSuppliers } from "@/hooks/queries/usePurchasing";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseOrder } from "@/types/api/purchasing";

import { CostLinesEditor, type CostLine } from "./CostLinesEditor";

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

  const [lines, setLines] = useState<CostLine[]>([]);

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

          <div className="border-t border-border pt-6">
            <CostLinesEditor lines={lines} onChange={setLines} currency={currency} />
          </div>

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
