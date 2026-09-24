"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
import { Input } from "@/components/ui/input";
import {
  useCreateFloor,
  useCreateTable,
  useDeleteTable,
  useDiningTables,
  useFloors,
  useUpdateTable,
} from "@/hooks/queries/useDining";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { humanize } from "@/lib/format";
import { TABLE_SHAPES, type DiningTable } from "@/types/api/dining";

/** Floors and tables — set up once, then the floor plan is where the work happens. */
export function TablesManager() {
  const { can } = usePermission();
  const canManage = can("table:manage");
  const { data: tables, isLoading, error, refetch } = useDiningTables();
  const { data: floors } = useFloors();
  const createFloor = useCreateFloor();
  const remove = useDeleteTable();

  const [floorName, setFloorName] = useState("");
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DiningTable | null>(null);

  const columns: DataTableColumn<DiningTable>[] = [
    {
      key: "name",
      header: "Table",
      render: (table) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{table.name}</span>
          {!table.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    { key: "floor", header: "Floor", render: (table) => table.floor?.name ?? "—" },
    { key: "seats", header: "Seats", align: "end", render: (table) => table.seats ?? "—" },
    {
      key: "shape",
      header: "Shape",
      render: (table) => (table.shape ? humanize(table.shape) : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (table) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(table);
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(table)}>
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Floors</h2>
          <div className="flex flex-wrap gap-2">
            {(floors ?? []).map((floor) => (
              <Badge key={floor.id} variant="secondary">
                {floor.name}
              </Badge>
            ))}
            {(floors ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No floors yet — tables can go without.
              </p>
            )}
          </div>
          <form
            className="flex max-w-sm gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!floorName.trim()) return;
              try {
                await createFloor.mutateAsync([{ name: floorName.trim() }]);
                setFloorName("");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            <Input
              value={floorName}
              onChange={(event) => setFloorName(event.target.value)}
              placeholder="Rooftop, Family hall…"
              aria-label="New floor name"
            />
            <Button type="submit" variant="outline" disabled={createFloor.isPending}>
              Add floor
            </Button>
          </form>
        </section>
      )}

      <div>
        {canManage && (
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New table
            </Button>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={tables ?? []}
          rowKey={(table) => table.id}
          loading={isLoading}
          error={error ? { message: error.message } : null}
          onRetry={() => refetch()}
          search={{ getText: (table) => `${table.name} ${table.floor?.name ?? ""}` }}
          mobileCardTitle={(table) => table.name}
          mobileCardSubtitle={(table) => table.floor?.name ?? ""}
          mobileCardFields={[
            { key: "seats", label: "Seats", render: (table) => table.seats ?? "—" },
          ]}
        />
      </div>

      <TableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        table={editing}
        floors={(floors ?? []).map((floor) => ({ value: floor.id, label: floor.name }))}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name}?`}
        description="Past sittings keep their history."
        confirmLabel="Delete table"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await remove.mutateAsync([pendingDelete.id]);
            toast.success("Table deleted");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </div>
  );
}

function TableDialog({
  open,
  onOpenChange,
  table,
  floors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: DiningTable | null;
  floors: Array<{ value: string; label: string }>;
}) {
  const create = useCreateTable();
  const update = useUpdateTable();
  const editing = !!table;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${table?.name}` : "New table"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            name: table?.name ?? "",
            seats: table?.seats?.toString() ?? "4",
            shape: table?.shape ?? "square",
            floor_id: table?.floor_id ?? "",
            is_active: table?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={Yup.object({
            name: Yup.string().trim().required("Give the table a name or number"),
            seats: Yup.number()
              .transform((value, original) => (original === "" ? undefined : value))
              .integer()
              .min(1, "At least one seat"),
          })}
          onSubmit={async (values, helpers) => {
            const payload: Partial<DiningTable> = {
              name: values.name.trim(),
              seats: values.seats === "" ? null : Number(values.seats),
              shape: values.shape,
              floor_id: values.floor_id || null,
              is_active: values.is_active,
            };
            try {
              if (editing) await update.mutateAsync([table!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Table updated" : "Table added");
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
                <FormTextField name="name" label="Name" placeholder="T1" autoFocus />
                <FormNumberField name="seats" label="Seats" min={1} step={1} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  name="shape"
                  label="Shape"
                  options={TABLE_SHAPES.map((shape) => ({ value: shape, label: humanize(shape) }))}
                />
                {floors.length > 0 && (
                  <FormSelectField
                    name="floor_id"
                    label="Floor"
                    placeholder="No floor"
                    options={floors}
                  />
                )}
              </div>
              {editing && <FormSwitch name="is_active" label="In use" />}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save table" : "Add table"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
