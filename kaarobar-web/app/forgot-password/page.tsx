"use client";

import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import { FormikTextField } from "@/components/ui/FormFields";
import { formStackClass } from "@/components/app/ui";
import { routes } from "@/lib/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  emptyForgotPasswordForm,
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/validations/auth";

export default function ForgotPasswordPage() {
  const toast = useToast();

  async function onSubmit(_values: ForgotPasswordFormValues) {
    toast.success("If an account exists for that email, reset instructions will be sent.");
  }

  return (
    <GuestOnly>
      <AuthShell
        badge="Account help"
        title="Reset your password"
        subtitle="Enter your email and we will send reset instructions."
        footer={
          <>
            Remembered it?{" "}
            <Link href={routes.login} variant="link">
              Back to sign in
            </Link>
          </>
        }
      >
        <CustomForm
          initialValues={emptyForgotPasswordForm()}
          validationSchema={forgotPasswordSchema}
          onSubmit={onSubmit}
          className={formStackClass}
        >
          {({ isSubmitting }) => (
            <>
              <FormikTextField
                name="email"
                label="Email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Send reset link
              </Button>
            </>
          )}
        </CustomForm>
      </AuthShell>
    </GuestOnly>
  );
}
