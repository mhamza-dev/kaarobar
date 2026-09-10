"use client";

import { Formik, Form } from "formik";
import { useState } from "react";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormTextField } from "@/components/forms/FormTextField";
import * as authService from "@/services/auth";
import { toast } from "@/hooks/useToast";

const schema = Yup.object({
  email: Yup.string().email("Enter a valid email address").required("Email is required"),
});

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If that address has an account, a reset link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <Formik
      initialValues={{ email: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await authService.forgotPassword(values.email);
        } catch (error) {
          // The backend never reveals whether an address is registered —
          // any failure here is a network problem worth surfacing, not a
          // "no such account" hint.
          toast.apiError(error);
        } finally {
          setSubmitting(false);
          setSent(true);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <FormTextField name="email" label="Email" type="email" autoComplete="email" autoFocus />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
