"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProductsList } from "@/hooks/queries/useProducts";
import {
  useCreateRentalUnit,
  useRentalUnits,
  useUpdateRentalUnit,
} from "@/hooks/queries/useRentals";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { UNIT_STATUSES, type RentalUnit } from "@/types/api/rentals";

/**
 * The hire fleet — each physical thing that goes out, by asset code.
 * A unit belongs to a `rental` product in the catalog; its own rate and
 * deposit override nothing the backend doesn't already know about.
 */
export function RentalUnitsTable() {
  const { can } = usePermission();
  const canManage = can("rental:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [status, setStatus] = useState("");
  const { data, isLoading, error, refetch } = useRentalUnits({ status: status || undefined });
  const [editing, setEditing] = useState<RentalUnit | null>(null);
  const [open, setOpen] = useState(false);

  const columns: DataTableColumn<RentalUnit>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (unit) => (
        <div>
          <p className="font-medium">{unit.asset_code}</p>
          {unit.serial_number && (
            <p className="text-xs text-muted-foreground">S/N {unit.serial_number}</p>
          )}
        </div>
      ),
    },
    { key: "status", header: "Status", render: (unit) => <StatusBadge status={unit.status} /> },
    {
      key: "rate",
      header: "Per day",
      align: "end",
      render: (unit) => formatMoney(unit.daily_rate, currency),
    },
    {
      key: "deposit",
      header: "Deposit",
      align: "end",
      render: (unit) => formatMoney(unit.deposit_amount, currency),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-24",
      render: (unit) =>
        canManage ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(unit);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All units</option>
          {UNIT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            New unit
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(unit) => unit.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (unit) => `${unit.asset_code} ${unit.serial_number ?? ""}` }}
        mobileCardTitle={(unit) => unit.asset_code}
        mobileCardFields={[
          { key: "status", label: "Status", render: (unit) => humanize(unit.status) },
        ]}
      />
      <UnitDialog open={open} onOpenChange={setOpen} unit={editing} />
    </>
  );
}

function UnitDialog({
  open,
  onOpenChange,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: RentalUnit | null;
}) {
  const create = useCreateRentalUnit();
  const update = useUpdateRentalUnit();
  const editing = !!unit;
  const { rows: products } = useProductsList({ kind: "rental", limit: 100 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${unit?.asset_code}` : "New unit"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            variant_id: unit?.variant_id ?? "",
            asset_code: unit?.asset_code ?? "",
            serial_number: unit?.serial_number ?? "",
            daily_rate: unit?.daily_rate ?? "",
            deposit_amount: unit?.deposit_amount ?? "",
            status: unit?.status ?? "available",
            condition_notes: unit?.condition_notes ?? "",
          }}
          enableReinitialize
          validationSchema={Yup.object({
            variant_id: Yup.string().required("Which product is this?"),
            asset_code: Yup.string().trim().required("Give it an asset code"),
          })}
          onSubmit={async (values, helpers) => {
            const payload: Partial<RentalUnit> = {
              variant_id: values.variant_id,
              asset_code: values.asset_code.trim(),
              serial_number: values.serial_number || null,
              daily_rate: values.daily_rate === "" ? null : String(values.daily_rate),
              deposit_amount: values.deposit_amount === "" ? null : String(values.deposit_amount),
              condition_notes: values.condition_notes || null,
              ...(editing ? { status: values.status } : {}),
            };
            try {
              if (editing) await update.mutateAsync([unit!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Unit updated" : "Unit added");
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
              <FormSearchSelectField
                name="variant_id"
                label="Product"
                placeholder="Pick a rental product"
                emptyMessage="No rental products in the catalog yet."
                options={products.flatMap((product) =>
                  (product.variants ?? []).map((variant) => ({
                    value: variant.id,
                    label:
                      (product.variants?.length ?? 0) > 1
                        ? `${product.name} — ${variant.name}`
                        : product.name,
                  })),
                )}
                disabled={editing}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="asset_code" label="Asset code" placeholder="GEN-004" />
                <FormTextField name="serial_number" label="Serial number" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormNumberField name="daily_rate" label="Per day" min={0} step={0.01} />
                <FormNumberField name="deposit_amount" label="Deposit" min={0} step={0.01} />
              </div>
              {editing && (
                <FormSelectField
                  name="status"
                  label="Status"
                  options={UNIT_STATUSES.filter((value) => value !== "on_hire").map((value) => ({
                    value,
                    label: humanize(value),
                  }))}
                />
              )}
              <FormTextField name="condition_notes" label="Condition" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save" : "Add unit"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
