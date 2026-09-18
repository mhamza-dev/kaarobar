"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateBranch, useUpdateBranch } from "@/hooks/queries/useBranches";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Branch } from "@/types/api/tenancy";

const schema = Yup.object({
  name: Yup.string().trim().required("Branch name is required"),
  code: Yup.string().trim(),
  phone: Yup.string().trim(),
  email: Yup.string().email("Enter a valid email address"),
  city: Yup.string().trim(),
  line1: Yup.string().trim(),
});

/**
 * Create/edit in one dialog — `branch` present means edit.
 *
 * The address is flat in the form (`line1`, `city`) and nested on the way
 * out, matching the backend's embedded `address` map, so the form fields
 * stay simple enough for `applyApiFieldErrors` to route errors onto.
 */
export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
}) {
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const editing = !!branch;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit branch" : "New branch"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update where this branch is and how to reach it."
              : "Add another location to this business."}
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{
            name: branch?.name ?? "",
            code: branch?.code ?? "",
            phone: branch?.phone ?? "",
            email: branch?.email ?? "",
            line1: branch?.address?.line1 ?? "",
            city: branch?.address?.city ?? "",
            is_warehouse: branch?.is_warehouse ?? false,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload: Partial<Branch> = {
              name: values.name,
              code: values.code || null,
              phone: values.phone || null,
              email: values.email || null,
              is_warehouse: values.is_warehouse,
              address: {
                line1: values.line1 || null,
                line2: null,
                city: values.city || null,
                state: null,
                postal_code: null,
                country_code: null,
              },
            };

            try {
              if (editing) {
                await updateBranch.mutateAsync([branch!.id, payload]);
                toast.success("Branch updated");
              } else {
                await createBranch.mutateAsync([payload]);
                toast.success("Branch created");
              }
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
              <FormTextField name="name" label="Branch name" autoFocus />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="code" label="Code" hint="Short label, e.g. GUL-01." />
                <FormTextField name="phone" label="Phone" type="tel" />
              </div>
              <FormTextField name="email" label="Email" type="email" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="line1" label="Street address" />
                <FormTextField name="city" label="City" />
              </div>
              <FormCheckbox
                name="is_warehouse"
                label="This is a warehouse"
                hint="Warehouses hold stock but don't sell at a counter."
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create branch"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
