"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { ColorPickerField } from "@/components/shared/ColorPickerField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import { useUpdateBusiness } from "@/hooks/queries/useBusinesses";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Business } from "@/types/api/tenancy";

const schema = Yup.object({
  name: Yup.string().trim().required("Business name is required"),
  email: Yup.string().email("Enter a valid email address"),
  website: Yup.string().url("Enter a full URL, including https://"),
  logo_url: Yup.string().url("Enter a full URL, including https://"),
  brand_color: Yup.string().matches(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2d6df6"),
});

/**
 * Editing a business — and the end-to-end proof of the brand-theme system:
 * `brand_color` is a flat string column, saved here, re-read by `/me` on
 * invalidation, and applied to the live CSS variables by `useBrandTheme()`.
 * Saving a colour repaints the shell without a reload.
 */
export function BusinessForm({ business }: { business: Business }) {
  const updateBusiness = useUpdateBusiness();

  return (
    <Formik
      initialValues={{
        name: business.name,
        legal_name: business.legal_name ?? "",
        tax_number: business.tax_number ?? "",
        phone: business.phone ?? "",
        email: business.email ?? "",
        website: business.website ?? "",
        logo_url: business.logo_url ?? "",
        brand_color: business.brand_color ?? "",
        prices_include_tax: business.prices_include_tax,
      }}
      enableReinitialize
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        try {
          await updateBusiness.mutateAsync({
            id: business.id,
            payload: {
              ...values,
              legal_name: values.legal_name || null,
              tax_number: values.tax_number || null,
              phone: values.phone || null,
              email: values.email || null,
              website: values.website || null,
              logo_url: values.logo_url || null,
              brand_color: values.brand_color || null,
            },
          });
          toast.success("Business updated");
          helpers.resetForm({ values });
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
      {({ isSubmitting, dirty }) => (
        <Form className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-4">
            <FormTextField name="name" label="Business name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                name="legal_name"
                label="Legal name"
                hint="Shown on invoices when it differs."
              />
              <FormTextField name="tax_number" label="Tax number" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField name="phone" label="Phone" type="tel" />
              <FormTextField name="email" label="Email" type="email" />
            </div>
            <FormTextField name="website" label="Website" type="url" />
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <FormTextField
              name="logo_url"
              label="Logo URL"
              type="url"
              hint="Shown on receipts and in the sidebar."
            />
            <ColorPickerField
              name="brand_color"
              label="Brand colour"
              hint="Applied across the app as soon as you save."
            />
          </div>

          <div className="border-t border-border pt-6">
            <FormSwitch
              name="prices_include_tax"
              label="Prices include tax"
              hint="Turn on when the price on the shelf is what the customer pays."
            />
          </div>

          <div>
            <Button type="submit" disabled={isSubmitting || !dirty}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
