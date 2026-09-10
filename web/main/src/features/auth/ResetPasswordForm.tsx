"use client";

import { Formik, Form } from "formik";
import { useRouter } from "next/navigation";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormTextField } from "@/components/forms/FormTextField";
import * as authService from "@/services/auth";
import { toast } from "@/hooks/useToast";

const schema = Yup.object({
  password: Yup.string().min(10, "At least 10 characters").required("Password is required"),
  passwordConfirmation: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Confirm your password"),
});

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  return (
    <Formik
      initialValues={{ password: "", passwordConfirmation: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await authService.resetPassword({
            token,
            password: values.password,
            password_confirmation: values.passwordConfirmation,
          });
          toast.success("Password updated. Sign in with your new password.");
          router.push("/login");
        } catch (error) {
          toast.apiError(error);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <FormTextField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
          />
          <FormTextField
            name="passwordConfirmation"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
