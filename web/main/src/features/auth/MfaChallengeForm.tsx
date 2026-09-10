"use client";

import { Formik, Form } from "formik";
import { useRouter, useSearchParams } from "next/navigation";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormTextField } from "@/components/forms/FormTextField";
import { useVerifyMfaChallenge } from "@/hooks/queries/useAuth";
import { toast } from "@/hooks/useToast";

const schema = Yup.object({
  code: Yup.string()
    .matches(/^\d{6}$/, "Enter the 6-digit code from your authenticator app")
    .required("Enter the code from your authenticator app"),
});

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challenge = searchParams.get("challenge") ?? "";
  const verify = useVerifyMfaChallenge();

  if (!challenge) {
    return (
      <p className="text-sm text-muted-foreground">
        This link is missing its challenge. Go back and sign in again.
      </p>
    );
  }

  return (
    <Formik
      initialValues={{ code: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, setFieldError }) => {
        try {
          await verify.mutateAsync({ challenge, code: values.code });
          router.push("/dashboard");
        } catch (error) {
          toast.apiError(error);
          setFieldError("code", "That code didn't match. Try the next one.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <FormTextField
            name="code"
            label="Authenticator code"
            type="text"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            hint="Open your authenticator app and enter the current 6-digit code."
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Verifying…" : "Verify"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
