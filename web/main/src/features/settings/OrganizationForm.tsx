"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/useToast";
import { useOrganization, useUpdateOrganization } from "@/hooks/queries/useOrganization";
import { applyApiFieldErrors } from "@/lib/api/formErrors";

// Deliberately short lists — the backend validates the full sets; these are
// the options a new organization realistically picks between.
const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR"].map((code) => ({
  value: code,
  label: code,
}));

const LOCALES = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
  { value: "ar", label: "العربية" },
];

const schema = Yup.object({
  name: Yup.string().trim().required("Organization name is required"),
  default_currency: Yup.string().required("Pick a default currency"),
  timezone: Yup.string().required("Timezone is required"),
  default_locale: Yup.string().required("Pick a default language"),
});

/**
 * `PATCH /organization` — the simplest possible instance of the form
 * pattern (no table, no dialog), which is why it is the first Phase 1
 * screen: it proves the Formik/Yup ⇄ `ApiError.fieldErrors` round trip on
 * its own before any CRUD list depends on it.
 */
export function OrganizationForm() {
  const { data: organization, isLoading } = useOrganization();
  const updateOrganization = useUpdateOrganization();

  if (isLoading || !organization) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Formik
      initialValues={{
        name: organization.name,
        default_currency: organization.default_currency,
        timezone: organization.timezone,
        default_locale: organization.default_locale,
        country_code: organization.country_code ?? "",
      }}
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        try {
          await updateOrganization.mutateAsync(values);
          toast.success("Organization updated");
          helpers.resetForm({ values });
        } catch (error) {
          // Field-level messages go back onto the fields that caused them;
          // anything else already surfaced as a toast from the hook.
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
        <Form className="flex max-w-xl flex-col gap-4">
          <FormTextField name="name" label="Organization name" />
          <FormTextField
            name="country_code"
            label="Country code"
            hint="Two-letter ISO code, e.g. PK."
          />
          <FormSelectField
            name="default_currency"
            label="Default currency"
            options={CURRENCIES}
            hint="New businesses start with this currency."
          />
          <FormTextField name="timezone" label="Timezone" hint="An IANA name, e.g. Asia/Karachi." />
          <FormSelectField name="default_locale" label="Default language" options={LOCALES} />

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
