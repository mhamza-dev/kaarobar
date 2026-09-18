"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateCategory, useUpdateCategory } from "@/hooks/queries/useCategories";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { Category } from "@/types/api/catalog";

const schema = Yup.object({
  name: Yup.string().trim().required("Give the category a name"),
});

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  categories: Category[];
}) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const editing = !!category;

  // A category can't be its own parent, nor sit under its own descendant.
  const parentOptions = categories
    .filter(
      (option) =>
        option.id !== category?.id && !(category && option.ancestor_ids.includes(category.id)),
    )
    .map((option) => ({ value: option.id, label: option.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${category?.name}` : "New category"}</DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={{
            name: category?.name ?? "",
            parent_id: category?.parent_id ?? "",
            description: category?.description ?? "",
            is_active: category?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload = {
              name: values.name,
              parent_id: values.parent_id || null,
              description: values.description || null,
              is_active: values.is_active,
            };

            try {
              if (editing) await updateCategory.mutateAsync([category!.id, payload]);
              else await createCategory.mutateAsync([payload]);

              toast.success(editing ? "Category updated" : "Category created");
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
              <FormTextField name="name" label="Name" autoFocus />
              <FormSelectField
                name="parent_id"
                label="Parent category"
                placeholder="Top level"
                options={parentOptions}
              />
              <FormTextareaField name="description" label="Description" rows={2} />
              <FormSwitch name="is_active" label="Active" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create category"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
