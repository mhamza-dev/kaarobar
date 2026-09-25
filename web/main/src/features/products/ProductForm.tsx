"use client";

import { Form, Formik, useFormikContext } from "formik";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import { useBrands, useTaxGroups, useUnits } from "@/hooks/queries/useCatalogSetup";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import { useCreateProduct, useUpdateProduct } from "@/hooks/queries/useProducts";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { normalizeProductForKind, productFieldRules, productKindLabel } from "@/lib/productKinds";
import { useSessionStore } from "@/stores/sessionStore";
import { PRODUCT_KINDS, type Product, type ProductKind } from "@/types/api/catalog";

type ProductFormValues = {
  name: string;
  kind: ProductKind;
  description: string;
  category_id: string;
  brand_id: string;
  unit_id: string;
  tax_group_id: string;
  tracks_stock: boolean;
  tracks_batch: boolean;
  tracks_serial: boolean;
  is_weighted: boolean;
  service_duration_minutes: string;
  rental_period_minutes: string;
  membership_days: string;
  is_active: boolean;
};

const schema = Yup.object({
  name: Yup.string().trim().required("Give the product a name"),
  kind: Yup.string().required("Choose what kind of product this is"),
  service_duration_minutes: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .positive("Must be longer than zero"),
  rental_period_minutes: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .positive("Must be longer than zero"),
  membership_days: Yup.number()
    .transform((value, original) => (original === "" ? undefined : value))
    .positive("Must be longer than zero"),
});

/** `""` ⇄ `null`, so a blank optional number isn't submitted as 0. */
function toNullableNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

/**
 * The fields that depend on `kind`.
 *
 * Split into its own component so it can read live Formik values: choosing
 * "service" has to swap the visible fields immediately, and the rules come
 * from `productFieldRules` — the same mirror of the backend's coercion the
 * submit handler uses, so nothing is shown that wouldn't survive a save.
 */
function KindDependentFields({ requiresBatch }: { requiresBatch: boolean }) {
  const { values } = useFormikContext<ProductFormValues>();
  const rules = productFieldRules(values.kind, {
    tracksStock: values.tracks_stock,
    requiresBatch,
  });

  return (
    <>
      {rules.canTrackStock && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <FormSwitch
            name="tracks_stock"
            label="Track stock"
            hint="Count this product in and out of each branch."
          />
          {rules.canTrackBatch && (
            <FormCheckbox
              name="tracks_batch"
              label="Track batches and expiry"
              hint={
                requiresBatch
                  ? "Required for your kind of business — recalls happen by lot number."
                  : undefined
              }
              disabled={requiresBatch}
            />
          )}
          {rules.canTrackSerial && (
            <FormCheckbox name="tracks_serial" label="Track serial numbers" />
          )}
        </div>
      )}

      {rules.canBeWeighted && (
        <FormCheckbox
          name="is_weighted"
          label="Sold by weight"
          hint="The scale sets the quantity at the counter."
        />
      )}

      {rules.needsServiceDuration && (
        <FormNumberField
          name="service_duration_minutes"
          label="How long it takes"
          suffix="min"
          min={1}
          hint="The appointment book uses this to allocate time."
        />
      )}

      {rules.needsRentalPeriod && (
        <FormNumberField name="rental_period_minutes" label="Rental period" suffix="min" min={1} />
      )}

      {rules.needsMembershipDays && (
        <FormNumberField name="membership_days" label="Membership length" suffix="days" min={1} />
      )}
    </>
  );
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const { data: categories } = useCategoriesList();
  const { data: brands } = useBrands();
  const { data: units } = useUnits();
  const { data: taxGroups } = useTaxGroups();
  const defaultGroup = taxGroups?.find((group) => group.is_default);
  const defaultTaxLabel = `Business default${defaultGroup ? ` (${defaultGroup.name})` : ""}`;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const business = useSessionStore((state) => state.scope?.business);

  const editing = !!product;
  const requiresBatch = business?.requires_batch ?? false;
  // The vertical decides which kinds this business may sell at all
  // (Verticals.product_kind_allowed?/2, resolved server-side onto the
  // business) — offering the rest would just produce a rejected save.
  const allowedKinds = business?.product_kinds?.length
    ? PRODUCT_KINDS.filter((kind) => business.product_kinds.includes(kind))
    : PRODUCT_KINDS;

  return (
    <Formik<ProductFormValues>
      initialValues={{
        name: product?.name ?? "",
        kind: product?.kind ?? (allowedKinds[0] as ProductKind),
        description: product?.description ?? "",
        category_id: product?.category_id ?? "",
        brand_id: product?.brand_id ?? "",
        unit_id: product?.unit_id ?? "",
        // Blank means "the business default", resolved at every quote — so
        // changing the default later moves these products with it.
        tax_group_id: product?.tax_group_id ?? "",
        tracks_stock: product?.tracks_stock ?? true,
        tracks_batch: product?.tracks_batch ?? false,
        tracks_serial: product?.tracks_serial ?? false,
        is_weighted: product?.is_weighted ?? false,
        service_duration_minutes: product?.service_duration_minutes?.toString() ?? "",
        rental_period_minutes: product?.rental_period_minutes?.toString() ?? "",
        membership_days: product?.membership_days?.toString() ?? "",
        is_active: product?.is_active ?? true,
      }}
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        // Strip whatever the chosen kind doesn't support, exactly as the
        // backend would — so the saved product matches the form.
        const normalized = normalizeProductForKind(
          {
            ...values,
            service_duration_minutes: toNullableNumber(values.service_duration_minutes),
            rental_period_minutes: toNullableNumber(values.rental_period_minutes),
            membership_days: toNullableNumber(values.membership_days),
          },
          { requiresBatch },
        );

        const payload = {
          ...normalized,
          description: values.description || null,
          category_id: values.category_id || null,
          brand_id: values.brand_id || null,
          unit_id: values.unit_id || null,
          tax_group_id: values.tax_group_id || null,
        };

        try {
          if (editing) {
            await updateProduct.mutateAsync({ id: product.id, payload });
            toast.success("Product updated");
          } else {
            const created = await createProduct.mutateAsync([payload]);
            toast.success("Product created");
            router.replace(`/products/${(created as Product).id}`);
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
      {({ isSubmitting }) => (
        <Form className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-4">
            <FormTextField name="name" label="Product name" autoFocus />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelectField
                name="kind"
                label="Kind"
                options={allowedKinds.map((kind) => ({
                  value: kind,
                  label: productKindLabel(kind),
                }))}
                hint="Decides which settings below apply."
              />
              <FormSelectField
                name="category_id"
                label="Category"
                placeholder="No category"
                options={(categories ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormSelectField
                name="brand_id"
                label="Brand"
                placeholder="No brand"
                options={(brands ?? [])
                  .filter((brand) => brand.is_active || brand.id === product?.brand_id)
                  .map((brand) => ({ value: brand.id, label: brand.name }))}
              />
              <FormSelectField
                name="unit_id"
                label="Sold by"
                placeholder="Each"
                options={(units ?? []).map((unit) => ({ value: unit.id, label: unit.name }))}
              />
              <FormSelectField
                name="tax_group_id"
                label="Tax"
                // An empty value shows the placeholder, so the default's name
                // goes there; the explicit option lets it be chosen again.
                placeholder={defaultTaxLabel}
                options={[
                  { value: "", label: defaultTaxLabel },
                  ...(taxGroups ?? []).map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
            </div>
            <FormTextareaField name="description" label="Description" rows={3} />
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <KindDependentFields requiresBatch={requiresBatch} />
          </div>

          <div className="border-t border-border pt-6">
            <FormSwitch
              name="is_active"
              label="Active"
              hint="Inactive products stay in reports but can't be sold."
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create product"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/products")}>
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
