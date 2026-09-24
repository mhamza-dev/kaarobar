"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { ColorPickerField } from "@/components/shared/ColorPickerField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateResource, useResources, useUpdateResource } from "@/hooks/queries/useScheduling";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { humanize } from "@/lib/format";
import { RESOURCE_KINDS, type Resource } from "@/types/api/scheduling";

/** Who and what can be booked — stylists, chairs, rooms, bays. */
export function ResourcesTable() {
  const { can } = usePermission();
  const canManage = can("resource:manage");
  const { data, isLoading, error, refetch } = useResources();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [open, setOpen] = useState(false);

  const columns: DataTableColumn<Resource>[] = [
    {
      key: "name",
      header: "Resource",
      render: (resource) => (
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full bg-brand-primary"
            style={resource.colour ? { backgroundColor: resource.colour } : undefined}
          />
          <span className="font-medium">{resource.name}</span>
          {!resource.bookable && <Badge variant="outline">Not bookable</Badge>}
        </div>
      ),
    },
    { key: "kind", header: "Kind", render: (resource) => humanize(resource.kind) },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-24",
      render: (resource) =>
        canManage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(resource);
              setOpen(true);
            }}
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            New resource
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(resource) => resource.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        mobileCardTitle={(resource) => resource.name}
        mobileCardSubtitle={(resource) => humanize(resource.kind)}
      />
      <ResourceDialog open={open} onOpenChange={setOpen} resource={editing} />
    </>
  );
}

function ResourceDialog({
  open,
  onOpenChange,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
}) {
  const create = useCreateResource();
  const update = useUpdateResource();
  const editing = !!resource;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${resource?.name}` : "New resource"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            name: resource?.name ?? "",
            kind: resource?.kind ?? "staff",
            colour: resource?.colour ?? "#6366f1",
            is_bookable: resource?.is_bookable ?? true,
            is_active: resource?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name it") })}
          onSubmit={async (values, helpers) => {
            const payload: Partial<Resource> = { ...values, name: values.name.trim() };
            try {
              if (editing) await update.mutateAsync([resource!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Resource updated" : "Resource added");
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
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="name" label="Name" placeholder="Ayesha" autoFocus />
                <FormSelectField
                  name="kind"
                  label="Kind"
                  options={RESOURCE_KINDS.map((kind) => ({ value: kind, label: humanize(kind) }))}
                />
              </div>
              <ColorPickerField name="colour" label="Colour in the diary" />
              <FormSwitch name="is_bookable" label="Takes bookings" />
              {editing && <FormSwitch name="is_active" label="Active" />}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save" : "Add resource"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
