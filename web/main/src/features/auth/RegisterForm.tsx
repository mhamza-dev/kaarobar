"use client";

import { Formik, Form, useFormikContext } from "formik";
import { useEffect } from "react";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney } from "@/lib/format";
import { useAdoptSession, useRegister } from "@/hooks/queries/useAuth";
import { useBusinessTypes } from "@/hooks/queries/useBusinessTypes";
import { usePlans } from "@/hooks/queries/useFinance";
import { toast } from "@/hooks/useToast";
import { subscribeNewAccount } from "@/services/billing";
import { useSessionStore } from "@/stores/sessionStore";
import type { Plan } from "@/types/api/billing";

const schema = Yup.object({
  name: Yup.string().required("Your name is required"),
  email: Yup.string().email("Enter a valid email address").required("Email is required"),
  password: Yup.string().min(10, "At least 10 characters").required("Password is required"),
  organizationName: Yup.string().required("Give your company a name"),
  businessName: Yup.string().required("Give your first shop a name"),
  businessType: Yup.string().required("Choose what kind of business it is"),
  plan: Yup.string(),
});

/** The plan a sign-up lands on when the pricing page didn't name one: the middle one. */
function defaultPlan(plans: Plan[], requested?: string): string {
  if (requested && plans.some((plan) => plan.code === requested)) return requested;
  return plans[Math.floor((plans.length - 1) / 2)]?.code ?? "";
}

/**
 * Fills in the default plan once the catalogue has loaded, if nobody has
 * picked one yet. Not `enableReinitialize`: that would reset every field,
 * wiping out whatever was typed while the plans were loading.
 */
function DefaultPlan({ plans, requested }: { plans: Plan[]; requested?: string }) {
  const { values, setFieldValue } = useFormikContext<{ plan: string }>();

  useEffect(() => {
    if (!values.plan && plans.length > 0) {
      void setFieldValue("plan", defaultPlan(plans, requested), false);
    }
  }, [plans, requested, values.plan, setFieldValue]);

  return null;
}

function planLabel(plan: Plan): string {
  return `${plan.name} — ${formatMoney(plan.amount, plan.currency)}/${plan.interval}`;
}

/**
 * Owner sign-up: the account, the organization, the first shop — and, when
 * this deployment sells plans, the plan, whose free trial starts on the spot.
 *
 * `initialPlan` comes from `?plan=` on the marketing site's pricing page.
 * The plan picker only appears once the catalogue has loaded and is
 * non-empty; a deployment that sells nothing leaves billing off entirely.
 *
 * Starting the trial happens *before* the new token is adopted into the
 * session, with the token passed explicitly — adopting it first would have
 * the `(auth)` layout redirect away while this was still running. A trial
 * that fails to start doesn't fail the sign-up: the account exists, and the
 * welcome screen points at the billing page.
 */
export function RegisterForm({ initialPlan }: { initialPlan?: string }) {
  const register = useRegister();
  const adoptSession = useAdoptSession();
  const setAfterSignIn = useSessionStore((state) => state.setAfterSignIn);
  const { data: businessTypes, isLoading: loadingTypes } = useBusinessTypes();
  const { data: catalogue, isLoading: loadingPlans } = usePlans();
  const plans = catalogue?.plans ?? [];

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
        plan: defaultPlan(plans, initialPlan),
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, setErrors }) => {
        try {
          const session = await register.mutateAsync({
            user: { name: values.name, email: values.email, password: values.password },
            organization: { name: values.organizationName },
            business: { name: values.businessName, business_type: values.businessType },
          });

          if (values.plan) {
            try {
              await subscribeNewAccount(session.token, values.plan);
            } catch {
              toast.info("Your account is ready. Choose a plan from Settings → Subscription.");
            }
          }

          setAfterSignIn("/welcome");
          adoptSession(session.token);
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
      {({ isSubmitting, values }) => {
        const chosen = plans.find((plan) => plan.code === values.plan);
        return (
          <Form className="flex flex-col gap-4">
            <DefaultPlan plans={plans} requested={initialPlan} />
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
            <FormTextField
              name="organizationName"
              label="Company name"
              autoComplete="organization"
            />
            <FormTextField name="businessName" label="First shop's name" />
            <FormSelectField
              name="businessType"
              label="What kind of business is it?"
              options={businessTypeOptions ?? []}
              disabled={loadingTypes}
              placeholder={loadingTypes ? "Loading…" : "Select a business type"}
            />
            {(loadingPlans || plans.length > 0) && (
              <>
                <div className="h-px bg-border" />
                <FormSelectField
                  name="plan"
                  label="Plan"
                  options={plans.map((plan) => ({ value: plan.code, label: planLabel(plan) }))}
                  disabled={loadingPlans}
                  placeholder={loadingPlans ? "Loading…" : "Choose a plan"}
                  hint={
                    chosen?.trial_days
                      ? `${chosen.trial_days}-day free trial. No card needed — change or cancel any time.`
                      : "Change or cancel any time."
                  }
                />
              </>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting
                ? "Creating your account…"
                : chosen?.trial_days
                  ? "Start free trial"
                  : "Create account"}
            </Button>
          </Form>
        );
      }}
    </Formik>
  );
}
