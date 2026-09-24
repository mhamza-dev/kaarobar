"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
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
import { useCreateStation, useStations, useUpdateStation } from "@/hooks/queries/useDining";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { KitchenStation } from "@/types/api/dining";

/**
 * Kitchen stations — grill, tandoor, drinks. A product's station (set on
 * the product) decides which screen its tickets land on; `prep_minutes` is
 * what the board measures lateness against.
 */
export function StationsTable() {
  const { can } = usePermission();
  const canManage = can("table:manage");
  const { data, isLoading, error, refetch } = useStations();
  const [editing, setEditing] = useState<KitchenStation | null>(null);
  const [open, setOpen] = useState(false);

  const columns: DataTableColumn<KitchenStation>[] = [
    {
      key: "name",
      header: "Station",
      render: (station) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{station.name}</span>
          {station.code && <Badge variant="outline">{station.code}</Badge>}
          {!station.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: "prep",
      header: "Target time",
      align: "end",
      render: (station) => (station.prep_minutes ? `${station.prep_minutes} min` : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-24",
      render: (station) =>
        canManage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(station);
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
            New station
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(station) => station.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        mobileCardTitle={(station) => station.name}
      />
      <StationDialog open={open} onOpenChange={setOpen} station={editing} />
    </>
  );
}

function StationDialog({
  open,
  onOpenChange,
  station,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: KitchenStation | null;
}) {
  const create = useCreateStation();
  const update = useUpdateStation();
  const editing = !!station;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${station?.name}` : "New station"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            name: station?.name ?? "",
            code: station?.code ?? "",
            prep_minutes: station?.prep_minutes?.toString() ?? "15",
            is_active: station?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={Yup.object({
            name: Yup.string().trim().required("Name the station"),
            prep_minutes: Yup.number()
              .transform((value, original) => (original === "" ? undefined : value))
              .integer()
              .min(1, "At least a minute"),
          })}
          onSubmit={async (values, helpers) => {
            const payload: Partial<KitchenStation> = {
              name: values.name.trim(),
              code: values.code || null,
              prep_minutes: values.prep_minutes === "" ? null : Number(values.prep_minutes),
              is_active: values.is_active,
            };
            try {
              if (editing) await update.mutateAsync([station!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Station updated" : "Station added");
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
                <FormTextField name="name" label="Name" placeholder="Grill" autoFocus />
                <FormTextField name="code" label="Code" placeholder="GRL" />
              </div>
              <FormNumberField
                name="prep_minutes"
                label="Target time"
                suffix="min"
                min={1}
                hint="Tickets past this show as late on the board."
              />
              {editing && <FormSwitch name="is_active" label="Active" />}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save station" : "Add station"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
