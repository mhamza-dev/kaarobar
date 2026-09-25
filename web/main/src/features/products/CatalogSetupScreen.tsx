"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAddModifier,
  useBrands,
  useCreateBrand,
  useCreateModifierGroup,
  useCreateOptionType,
  useCreateOptionValue,
  useCreateUnit,
  useDeleteBrand,
  useDeleteModifierGroup,
  useModifierGroups,
  useOptionTypes,
  useUnits,
  useUpdateBrand,
} from "@/hooks/queries/useCatalogSetup";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, formatQuantity, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { UNIT_DIMENSIONS, type Brand, type ModifierGroup, type Unit } from "@/types/api/catalog";

/**
 * The lists products are built from: brands, units of measure, the options
 * variants are made of (Size, Colour), and add-on groups offered at the
 * till. Each tab shows only to those who can manage it — or, for add-ons,
 * to businesses that sell them.
 */
export function CatalogSetupScreen() {
  const { can } = usePermission();
  const modules = useSessionStore((state) => state.scope?.business?.modules) ?? [];
  const tabs = [
    { value: "brands", label: "Brands", show: true },
    { value: "units", label: "Units", show: true },
    {
      value: "options",
      label: "Variant options",
      show: modules.includes("variants") || can("variant:manage"),
    },
    { value: "addons", label: "Add-ons", show: modules.includes("modifiers") },
  ].filter((tab) => tab.show);

  return (
    <Tabs defaultValue="brands">
      <TabsList variant="line">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="brands" className="pt-4">
        <BrandsTable />
      </TabsContent>
      <TabsContent value="units" className="pt-4">
        <UnitsTable />
      </TabsContent>
      <TabsContent value="options" className="pt-4">
        <OptionTypes />
      </TabsContent>
      <TabsContent value="addons" className="pt-4">
        <ModifierGroups />
      </TabsContent>
    </Tabs>
  );
}

// --- Brands ---------------------------------------------------------------------

function BrandsTable() {
  const { can } = usePermission();
  const canManage = can("brand:manage");
  const { data, isLoading, error, refetch } = useBrands();
  const remove = useDeleteBrand();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const columns: DataTableColumn<Brand>[] = [
    {
      key: "name",
      header: "Brand",
      render: (brand) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{brand.name}</span>
          {!brand.is_active && <Badge variant="outline">Hidden</Badge>}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (brand: Brand) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleting(brand)}>
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
            New brand
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(brand) => brand.id}
        onRowClick={canManage ? setEditing : undefined}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No brands yet.</p>}
        mobileCardTitle={(brand) => brand.name}
      />
      <BrandDialog
        open={creating || !!editing}
        brand={editing}
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
        description="Products of this brand keep existing, without a brand."
        confirmLabel="Delete brand"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Brand deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

function BrandDialog({
  open,
  brand,
  onOpenChange,
}: {
  open: boolean;
  brand: Brand | null;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateBrand();
  const update = useUpdateBrand();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{brand ? `Edit ${brand.name}` : "New brand"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{ name: brand?.name ?? "", is_active: brand?.is_active ?? true }}
          enableReinitialize
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name the brand") })}
          onSubmit={async (values, helpers) => {
            try {
              if (brand) await update.mutateAsync([brand.id, values]);
              else await create.mutateAsync([{ name: values.name }]);
              toast.success(brand ? "Brand updated" : "Brand added");
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
              {brand && <FormCheckbox name="is_active" label="Show in product forms" />}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {brand ? "Save brand" : "Add brand"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

// --- Units ----------------------------------------------------------------------

function UnitsTable() {
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useUnits();
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<Unit>[] = [
    {
      key: "name",
      header: "Unit",
      render: (unit) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{unit.name}</span>
          <code className="text-xs text-muted-foreground">{unit.code}</code>
          {unit.is_base && <Badge variant="secondary">Base</Badge>}
        </div>
      ),
    },
    { key: "dimension", header: "Measures", render: (unit) => humanize(unit.dimension) },
    {
      key: "factor",
      header: "In base units",
      align: "end",
      render: (unit) => formatQuantity(unit.factor_to_base),
    },
  ];

  return (
    <>
      {can("unit:manage") && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New unit
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(unit) => unit.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No units yet.</p>}
        mobileCardTitle={(unit) => `${unit.name} (${unit.code})`}
        mobileCardSubtitle={(unit) => humanize(unit.dimension)}
      />
      <UnitDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function UnitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateUnit();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New unit</DialogTitle>
          <DialogDescription>
            How many of its dimension&apos;s base unit it is — a dozen is 12 pieces, a kilogram 1000
            grams.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            code: "",
            name: "",
            dimension: "count",
            factor_to_base: "1",
            precision: "0",
          }}
          validationSchema={Yup.object({
            code: Yup.string().trim().required("A short code, like dz"),
            name: Yup.string().trim().required("Name the unit"),
            factor_to_base: Yup.number()
              .typeError("Enter a number")
              .positive("Above zero")
              .required(),
          })}
          onSubmit={async (values, helpers) => {
            try {
              await create.mutateAsync([
                {
                  code: values.code,
                  name: values.name,
                  dimension: values.dimension as (typeof UNIT_DIMENSIONS)[number],
                  factor_to_base: String(values.factor_to_base),
                  precision: Number(values.precision || 0),
                },
              ]);
              toast.success("Unit added");
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
            <Form className="grid gap-4 sm:grid-cols-2">
              <FormTextField name="name" label="Name" placeholder="Dozen" />
              <FormTextField name="code" label="Code" placeholder="dz" />
              <FormSelectField
                name="dimension"
                label="Measures"
                options={UNIT_DIMENSIONS.map((value) => ({ value, label: humanize(value) }))}
              />
              <FormNumberField name="factor_to_base" label="In base units" min={0} />
              <FormNumberField name="precision" label="Decimal places" min={0} max={4} />
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add unit
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

// --- Variant options ------------------------------------------------------------

function OptionTypes() {
  const { can } = usePermission();
  const canManage = can("variant:manage");
  const { data, isLoading, error, refetch } = useOptionTypes();
  const createType = useCreateOptionType();
  const [name, setName] = useState("");

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error) return <LoadError what="the variant options" onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The choices a product comes in. Pick values from these on a product&apos;s page to build its
        variants — every combination at once.
      </p>
      {(data ?? []).length === 0 && (
        <EmptyState title="No options yet" description="Add one — Size, say, or Colour." />
      )}
      {(data ?? []).map((type) => (
        <OptionTypeCard
          key={type.id}
          typeId={type.id}
          name={type.name}
          values={type.values ?? []}
          canManage={canManage}
        />
      ))}
      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            try {
              await createType.mutateAsync([{ name: name.trim() }]);
              toast.success(`${name.trim()} added`);
              setName("");
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New option, e.g. Size"
            aria-label="New option name"
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" disabled={!name.trim() || createType.isPending}>
            <Plus className="size-4" />
            Add option
          </Button>
        </form>
      )}
    </div>
  );
}

function OptionTypeCard({
  typeId,
  name,
  values,
  canManage,
}: {
  typeId: string;
  name: string;
  values: Array<{ id: string; value: string; hex_color: string | null }>;
  canManage: boolean;
}) {
  const createValue = useCreateOptionValue();
  const [value, setValue] = useState("");

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{name}</h3>
      <div className="flex flex-wrap gap-1.5">
        {values.map((entry) => (
          <Badge key={entry.id} variant="secondary" className="gap-1.5">
            {entry.hex_color && (
              <span
                className="size-2.5 rounded-full border border-border"
                style={{ backgroundColor: entry.hex_color }}
              />
            )}
            {entry.value}
          </Badge>
        ))}
        {values.length === 0 && (
          <span className="text-sm text-muted-foreground">No values yet.</span>
        )}
      </div>
      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!value.trim()) return;
            try {
              await createValue.mutateAsync([typeId, { value: value.trim() }]);
              setValue("");
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={`Add a ${name.toLowerCase()}`}
            aria-label={`New ${name} value`}
            className="h-8 max-w-48"
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={!value.trim() || createValue.isPending}
          >
            Add
          </Button>
        </form>
      )}
    </section>
  );
}

// --- Add-on groups --------------------------------------------------------------

function ModifierGroups() {
  const { can } = usePermission();
  const canManage = can("modifier:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useModifierGroups();
  const remove = useDeleteModifierGroup();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ModifierGroup | null>(null);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error) return <LoadError what="the add-on groups" onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Choices offered at the till with a product — attach a group on the product&apos;s page.
        </p>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New group
          </Button>
        )}
      </div>
      {(data ?? []).length === 0 && (
        <EmptyState title="No add-on groups yet" description="e.g. “Spice level”, or “Extras”." />
      )}
      {(data ?? []).map((group) => (
        <ModifierGroupCard
          key={group.id}
          group={group}
          currency={currency}
          canManage={canManage}
          onDelete={() => setDeleting(group)}
        />
      ))}
      <ModifierGroupDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="It's taken off every product it's attached to."
        confirmLabel="Delete group"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Add-on group deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </div>
  );
}

function ModifierGroupCard({
  group,
  currency,
  canManage,
  onDelete,
}: {
  group: ModifierGroup;
  currency: string;
  canManage: boolean;
  onDelete: () => void;
}) {
  const add = useAddModifier();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{group.name}</h3>
          <p className="text-xs text-muted-foreground">
            {group.selection === "single" ? "Pick one" : "Pick any"}
            {group.required && " · required"}
            {group.max_select ? ` · up to ${group.max_select}` : ""}
          </p>
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(group.modifiers ?? []).map((modifier) => (
          <li key={modifier.id} className="flex items-center justify-between p-2">
            <span>
              {modifier.name}
              {modifier.is_default && <span className="text-muted-foreground"> · default</span>}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {Number(modifier.price_delta ?? 0) > 0
                ? `+${formatMoney(modifier.price_delta, currency)}`
                : "Free"}
            </span>
          </li>
        ))}
        {(group.modifiers ?? []).length === 0 && (
          <li className="p-2 text-muted-foreground">No choices yet.</li>
        )}
      </ul>
      {canManage && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            try {
              await add.mutateAsync([group.id, { name: name.trim(), price_delta: price || null }]);
              setName("");
              setPrice("");
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Choice, e.g. Extra cheese"
            aria-label={`New choice in ${group.name}`}
            className="h-8 max-w-56"
          />
          <Input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="Extra cost"
            aria-label={`Extra cost for the new choice in ${group.name}`}
            className="h-8 w-28"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!name.trim() || add.isPending}
          >
            Add choice
          </Button>
        </form>
      )}
    </section>
  );
}

function ModifierGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateModifierGroup();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New add-on group</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{ name: "", selection: "single", required: false, max_select: "" }}
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name the group") })}
          onSubmit={async (values, helpers) => {
            try {
              await create.mutateAsync([
                {
                  name: values.name,
                  selection: values.selection as "single" | "multiple",
                  min_select: values.required ? 1 : 0,
                  max_select:
                    values.selection === "single"
                      ? 1
                      : values.max_select
                        ? Number(values.max_select)
                        : null,
                },
              ]);
              toast.success("Add-on group added");
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
          {({ isSubmitting, values }) => (
            <Form className="flex flex-col gap-4">
              <FormTextField name="name" label="Name" placeholder="Spice level" autoFocus />
              <FormSelectField
                name="selection"
                label="Customers pick"
                options={[
                  { value: "single", label: "One of them" },
                  { value: "multiple", label: "Any number" },
                ]}
              />
              {values.selection === "multiple" && (
                <FormNumberField
                  name="max_select"
                  label="At most"
                  min={1}
                  hint="Leave blank for no limit."
                />
              )}
              <FormCheckbox name="required" label="A choice is required" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add group
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
