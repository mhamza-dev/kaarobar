"use client";

import { Formik, Form } from "formik";
import { useRouter } from "next/navigation";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { useRegister } from "@/hooks/queries/useAuth";
import { useBusinessTypes } from "@/hooks/queries/useBusinessTypes";
import { toast } from "@/hooks/useToast";

const schema = Yup.object({
  name: Yup.string().required("Your name is required"),
  email: Yup.string().email("Enter a valid email address").required("Email is required"),
  password: Yup.string().min(10, "At least 10 characters").required("Password is required"),
  organizationName: Yup.string().required("Give your company a name"),
  businessName: Yup.string().required("Give your first shop a name"),
  businessType: Yup.string().required("Choose what kind of business it is"),
});

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const { data: businessTypes, isLoading: loadingTypes } = useBusinessTypes();

  const businessTypeOptions =
    businessTypes &&
    Object.values(businessTypes.groups)
      .flat()
      .map((option) => ({ value: option.type, label: option.label }));

  return (
    <Formik
      initialValues={{
        name: "",
        email: "",
        password: "",
        organizationName: "",
        businessName: "",
        businessType: "",
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, setErrors }) => {
        try {
          await register.mutateAsync({
            user: { name: values.name, email: values.email, password: values.password },
            organization: { name: values.organizationName },
            business: { name: values.businessName, business_type: values.businessType },
          });
          router.push("/dashboard");
        } catch (error) {
          // The organization's slug is derived from its name server-side, so
          // a name that's already taken comes back keyed as `slug` — point
          // it at the field the user actually typed into.
          const { handled, unmapped } = applyApiFieldErrors({
            error,
            values,
            setErrors,
            mapping: { slug: "organizationName" },
          });

          if (!handled) toast.apiError(error);
          for (const message of unmapped) toast.error(message);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <FormTextField name="name" label="Your name" autoComplete="name" autoFocus />
          <FormTextField name="email" label="Email" type="email" autoComplete="email" />
          <FormTextField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
          />
          <div className="h-px bg-border" />
          <FormTextField name="organizationName" label="Company name" autoComplete="organization" />
          <FormTextField name="businessName" label="First shop's name" />
          <FormSelectField
            name="businessType"
            label="What kind of business is it?"
            options={businessTypeOptions ?? []}
            disabled={loadingTypes}
            placeholder={loadingTypes ? "Loading…" : "Select a business type"}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating your account…" : "Create account"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
