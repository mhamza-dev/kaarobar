"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as Yup from "yup";

import { FormTextField } from "@/components/forms/FormTextField";
import { AuthShell } from "@/components/shared/AuthShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInvitation, useInvitationPreview } from "@/hooks/queries/useInvitations";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Accepting a staff invitation.
 *
 * Two shapes behind one screen, decided by the preview's `requires_account`:
 * someone who already has a Kaarobar account just confirms, while a new
 * invitee sets a name and password at the same time. Either way the backend
 * returns a real session (`AuthJSON.session`), so acceptance ends inside the
 * app rather than at a login form they'd have to fill in again.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const { data: preview, isLoading, isError } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation();
  const setToken = useSessionStore((state) => state.setToken);

  if (isLoading) {
    return (
      <AuthShell title="Checking your invitation">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </AuthShell>
    );
  }

  if (isError || !preview) {
    return (
      <AuthShell
        title="This invitation isn't valid"
        description="The link may have expired or already been used. Ask whoever invited you to send a new one."
      >
        <Button variant="outline" className="w-full" onClick={() => router.replace("/login")}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  const needsAccount = preview.requires_account;

  return (
    <AuthShell
      title={`Join ${preview.organization_name}`}
      description={`You've been invited as ${preview.role_name}${
        preview.business_name ? ` at ${preview.business_name}` : ""
      }.`}
    >
      <Formik
        initialValues={{ name: preview.name ?? "", password: "" }}
        validationSchema={Yup.object({
          name: needsAccount ? Yup.string().trim().required("Your name is required") : Yup.string(),
          password: needsAccount
            ? Yup.string().min(10, "At least 10 characters").required("Choose a password")
            : Yup.string(),
        })}
        onSubmit={async (values, helpers) => {
          try {
            const session = await acceptInvitation.mutateAsync({
              token,
              user: needsAccount ? { name: values.name, password: values.password } : undefined,
            });

            setToken(session.token);
            toast.success(`Welcome to ${preview.organization_name}`);
            router.replace("/dashboard");
          } catch (error) {
            const { handled, unmapped } = applyApiFieldErrors({
              error,
              values,
              setErrors: helpers.setErrors,
            });

            if (!handled) toast.apiError(error);
            for (const message of unmapped) toast.error(message);
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">Invitation for</p>
              <p className="font-medium">{preview.email}</p>
            </div>

            {needsAccount && (
              <>
                <FormTextField name="name" label="Your name" autoFocus />
                <FormTextField
                  name="password"
                  label="Choose a password"
                  type="password"
                  autoComplete="new-password"
                  hint="At least 10 characters."
                />
              </>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {needsAccount ? "Create account and join" : "Accept invitation"}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
}
