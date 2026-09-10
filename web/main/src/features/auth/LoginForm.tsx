"use client";

import { Formik, Form } from "formik";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormTextField } from "@/components/forms/FormTextField";
import { useLogin } from "@/hooks/queries/useAuth";
import { toast } from "@/hooks/useToast";
import { isMfaChallenge } from "@/types/api/auth";

const schema = Yup.object({
  email: Yup.string().email("Enter a valid email address").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();

  return (
    <Formik
      initialValues={{ email: "", password: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const result = await login.mutateAsync(values);

          if (isMfaChallenge(result)) {
            router.push(`/login/mfa?challenge=${encodeURIComponent(result.challenge)}`);
            return;
          }

          router.push(searchParams.get("next") || "/dashboard");
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
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@business.com"
          />
          <FormTextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
