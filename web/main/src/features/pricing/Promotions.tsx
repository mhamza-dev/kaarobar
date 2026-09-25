"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
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
import { useBrands } from "@/hooks/queries/useCatalogSetup";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import {
  useCreatePromotion,
  useDeletePromotion,
  usePromotions,
  useUpdatePromotion,
} from "@/hooks/queries/usePricing";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatMoney, formatQuantity, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PriceRule, PriceRulePayload } from "@/types/api/pricing";

const KIND_LABELS: Record<string, string> = {
  percent_off: "Percentage off",
  amount_off: "Amount off",
  override_price: "Special price",
  bogo: "Buy some, get some",
};

const SCOPE_LABELS: Record<string, string> = {
  all: "Everything",
  category: "A category",
  brand: "A brand",
  product: "A product",
};

/** What a promotion does, in words a cashier would use. */
function describe(rule: PriceRule, currency: string) {
  switch (rule.kind) {
    case "percent_off":
      return `${formatQuantity(rule.value)}% off`;
    case "amount_off":
      return `${formatMoney(rule.value, currency)} off`;
    case "override_price":
      return `Sells for ${formatMoney(rule.value, currency)}`;
    case "bogo":
      return `Buy ${formatQuantity(rule.buy_quantity)}, get ${formatQuantity(rule.get_quantity)}${
        rule.get_discount_percent && Number(rule.get_discount_percent) < 100
          ? ` at ${formatQuantity(rule.get_discount_percent)}% off`
          : " free"
      }`;
    default:
      return humanize(rule.kind);
  }
}

/**
 * Promotions — the backend's price rules. Applied automatically at every
 * quote while they're live, or only when their code is entered if they
 * have one.
 */
export function PromotionsTable({ onEdit }: { onEdit: (rule: PriceRule) => void }) {
  const { can } = usePermission();
  const canManage = can("price_rule:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = usePromotions();
  const remove = useDeletePromotion();
  const [deleting, setDeleting] = useState<PriceRule | null>(null);

  const columns: DataTableColumn<PriceRule>[] = [
    {
      key: "name",
      header: "Promotion",
      render: (rule) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{rule.name}</span>
            {!rule.is_active && <Badge variant="outline">Off</Badge>}
            {rule.code && <Badge variant="secondary">Code {rule.code}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{describe(rule, currency)}</p>
        </div>
      ),
    },
    {
      key: "scope",
      header: "On",
      render: (rule) => SCOPE_LABELS[rule.scope] ?? humanize(rule.scope),
    },
    {
      key: "dates",
      header: "Runs",
      render: (rule) =>
        rule.valid_from || rule.valid_to
          ? `${rule.valid_from ? formatDate(rule.valid_from) : "Now"} – ${rule.valid_to ? formatDate(rule.valid_to) : "open"}`
          : "Always",
    },
    {
      key: "used",
      header: "Used",
      align: "end",
      render: (rule) => `${rule.used_count}${rule.usage_limit ? ` / ${rule.usage_limit}` : ""}`,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (rule: PriceRule) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleting(rule)}>
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(rule) => rule.id}
        onRowClick={canManage ? onEdit : undefined}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">No promotions running.</p>
        }
        mobileCardTitle={(rule) => rule.name}
        mobileCardSubtitle={(rule) => describe(rule, currency)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="It stops applying straight away. Sales it already discounted keep their price."
        confirmLabel="Delete promotion"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Promotion deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

const schema = Yup.object({
  name: Yup.string().trim().required("Name the promotion"),
  value: Yup.string().when("kind", {
    is: (kind: string) => kind !== "bogo",
    then: (rule) => rule.required("Enter the discount"),
  }),
  buy_quantity: Yup.string().when("kind", {
    is: "bogo",
    then: (rule) => rule.required("How many to buy"),
  }),
  get_quantity: Yup.string().when("kind", {
    is: "bogo",
    then: (rule) => rule.required("How many they get"),
  }),
  target_id: Yup.string().when("scope", {
    is: (scope: string) => scope !== "all",
    then: (rule) => rule.required("Pick what it applies to"),
  }),
});

const toIso = (date: string, endOfDay = false) =>
  date ? new Date(`${date}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString() : null;

export function PromotionDialog({
  rule,
  open,
  onOpenChange,
}: {
  rule: PriceRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const create = useCreatePromotion();
  const update = useUpdatePromotion();
  const { data: categories } = useCategoriesList();
  const { data: brands } = useBrands();
  const [search, setSearch] = useState("");
  const { rows: products, isFetching } = useProductsList({
    q: useDebounce(search, 300) || undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit ${rule.name}` : "New promotion"}</DialogTitle>
          <DialogDescription>
            Applied at the till automatically while it runs — or only with its code, if it has one.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: rule?.name ?? "",
            kind: rule?.kind ?? "percent_off",
            value: rule?.value ?? "",
            buy_quantity: rule?.buy_quantity ?? "",
            get_quantity: rule?.get_quantity ?? "",
            get_discount_percent: rule?.get_discount_percent ?? "100",
            scope: rule?.scope ?? "all",
            target_id: rule?.target_id ?? "",
            min_subtotal: rule?.min_subtotal ?? "",
            code: rule?.code ?? "",
            valid_from: rule?.valid_from?.slice(0, 10) ?? "",
            valid_to: rule?.valid_to?.slice(0, 10) ?? "",
            usage_limit: rule?.usage_limit ? String(rule.usage_limit) : "",
            stackable: rule?.stackable ?? false,
            is_active: rule?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const bogo = values.kind === "bogo";
            const payload: PriceRulePayload = {
              name: values.name,
              kind: values.kind,
              scope: values.scope,
              target_id: values.scope === "all" ? null : values.target_id,
              value: bogo ? null : String(values.value),
              buy_quantity: bogo ? String(values.buy_quantity) : null,
              get_quantity: bogo ? String(values.get_quantity) : null,
              get_discount_percent: bogo ? String(values.get_discount_percent || 100) : null,
              min_subtotal: values.min_subtotal ? String(values.min_subtotal) : null,
              code: values.code.trim() || null,
              valid_from: toIso(values.valid_from),
              valid_to: toIso(values.valid_to, true),
              usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
              stackable: values.stackable,
              is_active: values.is_active,
            };
            try {
              if (rule) await update.mutateAsync([rule.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(rule ? "Promotion updated" : "Promotion added");
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
            <Form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
              <FormTextField name="name" label="Name" placeholder="Eid sale" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  name="kind"
                  label="Discount"
                  options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
                />
                {values.kind === "bogo" ? (
                  <>
                    <FormNumberField name="buy_quantity" label="Buy" min={1} />
                    <FormNumberField name="get_quantity" label="Get" min={1} />
                    <FormNumberField
                      name="get_discount_percent"
                      label="Off the ones they get"
                      min={0}
                      max={100}
                      suffix="%"
                      hint="100 is free."
                    />
                  </>
                ) : (
                  <FormNumberField
                    name="value"
                    label={values.kind === "percent_off" ? "Percentage" : "Amount"}
                    min={0}
                    suffix={values.kind === "percent_off" ? "%" : currency}
                  />
                )}
                <FormSelectField
                  name="scope"
                  label="On"
                  options={Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label }))}
                />
                {values.scope === "category" && (
                  <FormSelectField
                    name="target_id"
                    label="Category"
                    options={(categories ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                    }))}
                  />
                )}
                {values.scope === "brand" && (
                  <FormSelectField
                    name="target_id"
                    label="Brand"
                    options={(brands ?? []).map((brand) => ({
                      value: brand.id,
                      label: brand.name,
                    }))}
                  />
                )}
                {values.scope === "product" && (
                  <FormSearchSelectField
                    name="target_id"
                    label="Product"
                    placeholder="Pick a product"
                    searchPlaceholder="Search the catalog…"
                    options={products.map((product) => ({
                      value: product.id,
                      label: product.name,
                    }))}
                    onSearchChange={setSearch}
                    loading={isFetching}
                  />
                )}
                <FormDatePicker name="valid_from" label="Starts" />
                <FormDatePicker name="valid_to" label="Ends" />
                <FormNumberField
                  name="min_subtotal"
                  label="Minimum spend"
                  min={0}
                  suffix={currency}
                />
                <FormTextField
                  name="code"
                  label="Code"
                  hint="Leave blank to apply automatically."
                />
                <FormNumberField
                  name="usage_limit"
                  label="Use at most"
                  min={1}
                  hint="Blank for no limit."
                />
              </div>
              <FormCheckbox name="stackable" label="Combines with other promotions" />
              <FormCheckbox name="is_active" label="Running" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {rule ? "Save promotion" : "Add promotion"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
