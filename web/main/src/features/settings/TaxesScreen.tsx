"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus, Star } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateTax,
  useCreateTaxGroup,
  useDeleteTax,
  useDeleteTaxGroup,
  useSetDefaultTaxGroup,
  useTaxes,
  useTaxGroups,
  useUpdateTax,
  useUpdateTaxGroup,
} from "@/hooks/queries/useCatalogSetup";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, fractionToPercent, percentToFraction } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Tax, TaxGroup } from "@/types/api/catalog";

/**
 * Taxes and the groups products carry them in. A product's tax is its
 * group's taxes applied in order, so a change here changes every price
 * rung up afterwards — hence the confirmation on anything destructive.
 */
export function TaxesScreen() {
  return (
    <Tabs defaultValue="groups">
      <TabsList variant="line">
        <TabsTrigger value="groups">Tax groups</TabsTrigger>
        <TabsTrigger value="taxes">Taxes</TabsTrigger>
      </TabsList>
      <TabsContent value="groups" className="pt-4">
        <TaxGroupsTable />
      </TabsContent>
      <TabsContent value="taxes" className="pt-4">
        <TaxesTable />
      </TabsContent>
    </Tabs>
  );
}

function rateLabel(tax: Tax, currency: string) {
  return tax.kind === "percentage"
    ? `${fractionToPercent(tax.rate)}%`
    : formatMoney(tax.rate, currency);
}

function TaxesTable() {
  const { can } = usePermission();
  const canManage = can("tax:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useTaxes();
  const remove = useDeleteTax();
  const [editing, setEditing] = useState<Tax | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Tax | null>(null);

  const columns: DataTableColumn<Tax>[] = [
    {
      key: "name",
      header: "Tax",
      render: (tax) => (
        <div>
          <p className="font-medium">{tax.name}</p>
          <p className="text-xs text-muted-foreground">
            Printed as {tax.label}
            {tax.jurisdiction && ` · ${tax.jurisdiction}`}
          </p>
        </div>
      ),
    },
    { key: "rate", header: "Rate", align: "end", render: (tax) => rateLabel(tax, currency) },
    {
      key: "flags",
      header: "",
      render: (tax) => (
        <div className="flex gap-1">
          {tax.is_compound && <Badge variant="outline">Compound</Badge>}
          {!tax.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (tax: Tax) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleting(tax)}>
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New tax
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(tax) => tax.id}
        onRowClick={canManage ? setEditing : undefined}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No taxes yet.</p>}
        mobileCardTitle={(tax) => tax.name}
        mobileCardFields={[
          { key: "rate", label: "Rate", render: (tax) => rateLabel(tax, currency) },
        ]}
      />
      <TaxDialog
        open={creating || !!editing}
        tax={editing}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="It's removed from every tax group that uses it. Past sales keep the tax they were charged."
        confirmLabel="Delete tax"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Tax deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

const taxSchema = Yup.object({
  name: Yup.string().trim().required("Name the tax"),
  kind: Yup.string().required(),
  rate: Yup.number()
    .typeError("Enter the rate")
    .min(0, "Can't be negative")
    .required("Enter the rate"),
});

function TaxDialog({
  open,
  tax,
  currency,
  onOpenChange,
}: {
  open: boolean;
  tax: Tax | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTax();
  const update = useUpdateTax();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tax ? `Edit ${tax.name}` : "New tax"}</DialogTitle>
          <DialogDescription>
            A percentage of the price, or a fixed amount per item.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: tax?.name ?? "",
            label: tax?.label ?? "",
            code: tax?.code ?? "",
            kind: tax?.kind ?? "percentage",
            rate: tax ? (tax.kind === "percentage" ? fractionToPercent(tax.rate) : tax.rate) : "",
            jurisdiction: tax?.jurisdiction ?? "",
            is_compound: tax?.is_compound ?? false,
            is_active: tax?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={taxSchema}
          onSubmit={async (values, helpers) => {
            // People type 17 for 17%; the backend stores 0.17.
            const rate =
              values.kind === "percentage" ? percentToFraction(values.rate)! : String(values.rate);
            const payload = {
              name: values.name,
              label: values.label || null,
              code: values.code || null,
              kind: values.kind as "percentage" | "fixed",
              rate,
              jurisdiction: values.jurisdiction || null,
              is_compound: values.is_compound,
              is_active: values.is_active,
            };
            try {
              if (tax) await update.mutateAsync([tax.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(tax ? "Tax updated" : "Tax added");
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
                <FormTextField name="name" label="Name" placeholder="General sales tax" />
                <FormTextField name="label" label="On receipts" placeholder="GST" />
                <FormSelectField
                  name="kind"
                  label="Charged as"
                  options={[
                    { value: "percentage", label: "A percentage" },
                    { value: "fixed", label: "A fixed amount" },
                  ]}
                />
                <FormNumberField
                  name="rate"
                  label="Rate"
                  min={0}
                  suffix={values.kind === "percentage" ? "%" : currency}
                />
                <FormTextField name="code" label="Code" />
                <FormTextField name="jurisdiction" label="Jurisdiction" placeholder="Punjab" />
              </div>
              <FormCheckbox
                name="is_compound"
                label="Compound"
                hint="Charged on the price plus the taxes before it in a group."
              />
              <FormCheckbox name="is_active" label="In use" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {tax ? "Save tax" : "Add tax"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

function TaxGroupsTable() {
  const { can } = usePermission();
  const canManage = can("tax:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useTaxGroups();
  const makeDefault = useSetDefaultTaxGroup();
  const remove = useDeleteTaxGroup();
  const [editing, setEditing] = useState<TaxGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TaxGroup | null>(null);

  const columns: DataTableColumn<TaxGroup>[] = [
    {
      key: "name",
      header: "Group",
      render: (group) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{group.name}</span>
          {group.is_default && <Badge variant="secondary">Default</Badge>}
          {group.is_exempt && <Badge variant="outline">Exempt</Badge>}
        </div>
      ),
    },
    {
      key: "taxes",
      header: "Taxes",
      render: (group) =>
        group.taxes.length
          ? group.taxes.map((tax) => `${tax.label} ${rateLabel(tax, currency)}`).join(" + ")
          : "None",
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (group: TaxGroup) => (
              <div className="flex justify-end gap-1">
                {!group.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={makeDefault.isPending}
                    onClick={async () => {
                      try {
                        await makeDefault.mutateAsync([group.id]);
                        toast.success(`${group.name} is now the default`);
                      } catch {
                        // Toasted by the hook.
                      }
                    }}
                  >
                    <Star className="size-3.5" />
                    Make default
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDeleting(group)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          New products get the default group unless you pick another.
        </p>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New group
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(group) => group.id}
        onRowClick={canManage ? setEditing : undefined}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No tax groups yet.</p>}
        mobileCardTitle={(group) => group.name}
        mobileCardFields={[
          {
            key: "taxes",
            label: "Taxes",
            render: (group) => group.taxes.map((tax) => tax.label).join(" + ") || "None",
          },
        ]}
      />
      <TaxGroupDialog
        open={creating || !!editing}
        group={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="It can't be deleted while products still use it — move them to another group first."
        confirmLabel="Delete group"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Tax group deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

function TaxGroupDialog({
  open,
  group,
  onOpenChange,
}: {
  open: boolean;
  group: TaxGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: taxes } = useTaxes();
  const create = useCreateTaxGroup();
  const update = useUpdateTaxGroup();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? `Edit ${group.name}` : "New tax group"}</DialogTitle>
          <DialogDescription>
            The taxes a product in this group is charged, in order.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: group?.name ?? "",
            code: group?.code ?? "",
            is_exempt: group?.is_exempt ?? false,
            tax_ids: group?.taxes.map((tax) => tax.id) ?? [],
          }}
          enableReinitialize
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name the group") })}
          onSubmit={async (values, helpers) => {
            const payload = {
              name: values.name,
              code: values.code || null,
              is_exempt: values.is_exempt,
              tax_ids: values.is_exempt ? [] : values.tax_ids,
            };
            try {
              if (group) await update.mutateAsync([group.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(group ? "Group updated" : "Group added");
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
          {({ isSubmitting, values, setFieldValue }) => (
            <Form className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="name" label="Name" placeholder="Standard rate" />
                <FormTextField name="code" label="Code" />
              </div>
              <FormCheckbox
                name="is_exempt"
                label="Exempt"
                hint="No tax at all — e.g. basic food."
              />
              {!values.is_exempt && (
                <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Taxes</legend>
                  {(taxes ?? [])
                    .filter((tax) => tax.is_active)
                    .map((tax) => {
                      const checked = values.tax_ids.includes(tax.id);
                      return (
                        <label key={tax.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              void setFieldValue(
                                "tax_ids",
                                next
                                  ? [...values.tax_ids, tax.id]
                                  : values.tax_ids.filter((id) => id !== tax.id),
                              )
                            }
                          />
                          {tax.name}
                          <span className="text-muted-foreground">({tax.label})</span>
                        </label>
                      );
                    })}
                  {(taxes ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Add a tax first.</p>
                  )}
                </fieldset>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {group ? "Save group" : "Add group"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
