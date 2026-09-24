"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

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

/**
 * A confirmation that has to say why.
 *
 * Several transitions refuse to happen without a reason on the record —
 * cancelling a hire or a job, declining a quote — because "cancelled" with
 * nothing said is indistinguishable from a mistake. `ConfirmDialog` can't
 * collect one, so these go through here instead; the reason is required
 * client-side too, rather than left to come back as a 422.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel,
  destructive = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Resolve to close the dialog; throw to keep it open (the caller toasts). */
  onSubmit: (reason: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Formik
          initialValues={{ reason: "" }}
          enableReinitialize
          validationSchema={Yup.object({ reason: Yup.string().trim().required("Say why") })}
          onSubmit={async (values, helpers) => {
            try {
              await onSubmit(values.reason.trim());
              helpers.resetForm();
              onOpenChange(false);
            } catch {
              // The caller's mutation hook has already toasted.
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormTextareaField name="reason" label={label} rows={3} placeholder={placeholder} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant={destructive ? "destructive" : "default"}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {confirmLabel}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
