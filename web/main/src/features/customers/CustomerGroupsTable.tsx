"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
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
import {
  useCreateCustomerGroup,
  useCustomerGroups,
  useDeleteCustomerGroup,
  useUpdateCustomerGroup,
} from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, fractionToPercent, percentToFraction } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { CustomerGroup } from "@/types/api/crm";

export function CustomerGroupsTable() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useCustomerGroups();
  const remove = useDeleteCustomerGroup();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerGroup | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerGroup | null>(null);
  const canManage = can("customer_group:manage");

  const columns: DataTableColumn<CustomerGroup>[] = [
    {
      key: "name",
      header: "Group",
      render: (group) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{group.name}</p>
            {group.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
          {group.is_default && <Badge variant="secondary">Default</Badge>}
          {!group.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: "discount",
      header: "Discount",
      align: "end",
      render: (group) =>
        group.discount_percent && Number(group.discount_percent) > 0
          ? `${fractionToPercent(group.discount_percent)}%`
          : "—",
    },
    {
      key: "credit",
      header: "Credit",
      render: (group) =>
        group.credit_allowed
          ? group.credit_limit
            ? `Up to ${formatMoney(group.credit_limit, currency)}`
            : "No limit"
          : "Cash only",
    },
    {
      key: "terms",
      header: "Terms",
      align: "end",
      render: (group) =>
        group.payment_terms_days == null ? "—" : `${group.payment_terms_days} days`,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (group) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(group);
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(group)}>
              Delete
            </Button>
          </div>
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
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New group
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(group) => group.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (group) => `${group.name} ${group.code ?? ""}` }}
        mobileCardTitle={(group) => group.name}
        mobileCardSubtitle={(group) => group.description ?? ""}
      />

      <GroupDialog open={dialogOpen} onOpenChange={setDialogOpen} group={editing} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name}?`}
        description="Customers in this group keep their records; they just lose the group's terms."
        confirmLabel="Delete group"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await remove.mutateAsync([pendingDelete.id]);
            toast.success("Group deleted");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

const optionalNumber = () =>
  Yup.number().transform((value, original) => (original === "" ? undefined : value));

const schema = Yup.object({
  name: Yup.string().trim().required("Group name is required"),
  discount_percent: optionalNumber()
    .min(0, "Can't be negative")
    .max(100, "Can't be more than 100%"),
  payment_terms_days: optionalNumber().min(0, "Can't be negative"),
  credit_limit: optionalNumber().min(0, "Can't be negative"),
  loyalty_multiplier: optionalNumber().min(0, "Can't be negative"),
});

function GroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CustomerGroup | null;
}) {
  const create = useCreateCustomerGroup();
  const update = useUpdateCustomerGroup();
  const editing = !!group;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${group?.name}` : "New customer group"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            name: group?.name ?? "",
            code: group?.code ?? "",
            description: group?.description ?? "",
            discount_percent: fractionToPercent(group?.discount_percent ?? null),
            payment_terms_days: group?.payment_terms_days?.toString() ?? "",
            credit_allowed: group?.credit_allowed ?? false,
            credit_limit: group?.credit_limit ?? "",
            loyalty_multiplier: group?.loyalty_multiplier ?? "1",
            is_default: group?.is_default ?? false,
            is_active: group?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload: Partial<CustomerGroup> = {
              name: values.name,
              code: values.code || null,
              description: values.description || null,
              discount_percent: percentToFraction(values.discount_percent),
              payment_terms_days:
                values.payment_terms_days === "" ? null : Number(values.payment_terms_days),
              credit_allowed: values.credit_allowed,
              credit_limit:
                values.credit_allowed && values.credit_limit !== ""
                  ? String(values.credit_limit)
                  : null,
              // NOT NULL in the database (default 1): a null here is a 500,
              // not a validation error, so blank means "the normal rate".
              loyalty_multiplier:
                values.loyalty_multiplier === "" ? "1" : String(values.loyalty_multiplier),
              is_default: values.is_default,
              is_active: values.is_active,
            };

            try {
              if (editing) await update.mutateAsync([group!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Group updated" : "Group created");
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
          {({ isSubmitting, values }) => (
            <Form className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="name" label="Name" autoFocus />
                <FormTextField name="code" label="Code" />
              </div>
              <FormTextareaField name="description" label="Description" rows={2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormNumberField
                  name="discount_percent"
                  label="Discount"
                  suffix="%"
                  min={0}
                  max={100}
                  step={0.5}
                />
                <FormNumberField
                  name="payment_terms_days"
                  label="Payment terms"
                  suffix="days"
                  min={0}
                />
              </div>
              <FormNumberField
                name="loyalty_multiplier"
                label="Loyalty multiplier"
                min={0}
                step={0.1}
                hint="1 earns the programme's normal rate; 2 earns double."
              />
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <FormSwitch name="credit_allowed" label="Allow selling on account" />
                {values.credit_allowed && (
                  <FormNumberField
                    name="credit_limit"
                    label="Credit limit"
                    min={0}
                    step={0.01}
                    hint="Leave blank for no limit."
                  />
                )}
              </div>
              <FormSwitch
                name="is_default"
                label="Default group"
                hint="New customers join this group unless another is picked."
              />
              <FormSwitch name="is_active" label="Active" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create group"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
