"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateInvitation } from "@/hooks/queries/useInvitations";
import { useRolesList } from "@/hooks/queries/useRoles";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";

const schema = Yup.object({
  email: Yup.string().email("Enter a valid email address").required("Email is required"),
  name: Yup.string().trim(),
  role_id: Yup.string().required("Pick the role they'll have"),
  message: Yup.string().trim(),
});

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: roles } = useRolesList();
  const createInvitation = useCreateInvitation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link. Accepting it creates their account and signs them
            in.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{ email: "", name: "", role_id: "", message: "" }}
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            try {
              await createInvitation.mutateAsync([
                {
                  email: values.email,
                  name: values.name || undefined,
                  role_id: values.role_id,
                  message: values.message || undefined,
                },
              ]);
              toast.success(`Invitation sent to ${values.email}`);
              helpers.resetForm();
              onOpenChange(false);
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
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormTextField name="email" label="Email" type="email" autoFocus />
              <FormTextField name="name" label="Name" hint="Optional — helps them recognise it." />
              <FormSelectField
                name="role_id"
                label="Role"
                options={(roles ?? []).map((role) => ({ value: role.id, label: role.name }))}
              />
              <FormTextareaField
                name="message"
                label="Message"
                rows={3}
                hint="Optional note included in the email."
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Send invitation
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
