"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSkeleton } from "@/components/shared/DetailSkeleton";
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
import { useBranchesList } from "@/hooks/queries/useBranches";
import {
  useCreatePriceList,
  useDeleteListPrice,
  useDeletePriceList,
  usePriceList,
  usePriceLists,
  usePutListPrice,
  useUpdatePriceList,
} from "@/hooks/queries/usePricing";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney, formatQuantity, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import {
  PRICE_LIST_KINDS,
  SALES_CHANNELS,
  type PriceList,
  type PriceListItem,
} from "@/types/api/pricing";

/**
 * Price lists override the catalog price for a branch, a sales channel or
 * a customer group. Where two lists price the same thing, the higher
 * priority wins — the backend decides that, at every quote.
 */
export function PriceListsTable() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = usePriceLists();

  const columns: DataTableColumn<PriceList>[] = [
    {
      key: "name",
      header: "List",
      render: (list) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{list.name}</span>
          {!list.is_active && <Badge variant="outline">Off</Badge>}
        </div>
      ),
    },
    { key: "kind", header: "For", render: (list) => describeScope(list) },
    { key: "priority", header: "Priority", align: "end", render: (list) => list.priority },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(list) => list.id}
      onRowClick={(list) => router.push(`/price-lists/${list.id}`)}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={
        <p className="p-6 text-center text-sm text-muted-foreground">
          No price lists. Products sell at their catalog price.
        </p>
      }
      mobileCardTitle={(list) => list.name}
      mobileCardSubtitle={(list) => describeScope(list)}
    />
  );
}

function describeScope(list: PriceList) {
  if (list.kind === "channel" && list.channel) return `${humanize(list.channel)} sales`;
  return humanize(list.kind);
}

const listSchema = Yup.object({
  name: Yup.string().trim().required("Name the list"),
  kind: Yup.string().required(),
  priority: Yup.number().typeError("Enter a number").integer().min(0),
});

export function PriceListDialog({
  list,
  open,
  onOpenChange,
}: {
  list?: PriceList | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: branches } = useBranchesList();
  const create = useCreatePriceList();
  const update = useUpdatePriceList();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{list ? `Edit ${list.name}` : "New price list"}</DialogTitle>
          <DialogDescription>
            Set which sales it applies to; add prices to it next.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: list?.name ?? "",
            kind: list?.kind ?? "channel",
            channel: list?.channel ?? "wholesale",
            branch_id: list?.branch_id ?? "",
            priority: String(list?.priority ?? 10),
            is_active: list?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={listSchema}
          onSubmit={async (values, helpers) => {
            const payload = {
              name: values.name,
              kind: values.kind,
              currency,
              channel: values.kind === "channel" ? values.channel : null,
              branch_id: values.kind === "branch" ? values.branch_id || null : null,
              priority: Number(values.priority || 0),
              is_active: values.is_active,
            };
            try {
              if (list) {
                await update.mutateAsync([list.id, payload]);
                toast.success("Price list updated");
                onOpenChange(false);
              } else {
                const created = (await create.mutateAsync([payload])) as PriceList;
                toast.success("Price list added");
                onOpenChange(false);
                router.push(`/price-lists/${created.id}`);
              }
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
              <FormTextField name="name" label="Name" placeholder="Wholesale" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  name="kind"
                  label="Applies to"
                  options={PRICE_LIST_KINDS.map((value) => ({ value, label: humanize(value) }))}
                />
                {values.kind === "channel" && (
                  <FormSelectField
                    name="channel"
                    label="Channel"
                    options={SALES_CHANNELS.map((value) => ({ value, label: humanize(value) }))}
                  />
                )}
                {values.kind === "branch" && (
                  <FormSelectField
                    name="branch_id"
                    label="Branch"
                    options={(branches ?? []).map((branch) => ({
                      value: branch.id,
                      label: branch.name,
                    }))}
                  />
                )}
                <FormNumberField name="priority" label="Priority" min={0} hint="Higher wins." />
              </div>
              <FormCheckbox name="is_active" label="In use" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {list ? "Save" : "Add list"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

/** One list: what it prices and at what, with the price editor. */
export function PriceListDetail({ listId }: { listId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const canManage = can("price_list:manage");
  const { data: list, isLoading, isError, refetch } = usePriceList(listId);
  const removePrice = useDeleteListPrice();
  const removeList = useDeletePriceList();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !list) return <LoadError what="this price list" onRetry={() => refetch()} />;

  const money = (value: string | null | undefined) => formatMoney(value, list.currency);

  const columns: DataTableColumn<PriceListItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => (
        <div>
          <p className="font-medium">{item.variant?.product?.name ?? "—"}</p>
          {item.variant?.name && item.variant.name !== item.variant.product?.name && (
            <p className="text-xs text-muted-foreground">{item.variant.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "catalog",
      header: "Catalog price",
      align: "end",
      render: (item) => money(item.variant?.price),
    },
    {
      key: "price",
      header: "On this list",
      align: "end",
      render: (item) => <span className="font-medium">{money(item.price)}</span>,
    },
    {
      key: "min",
      header: "From",
      align: "end",
      render: (item) => (item.min_quantity ? `${formatQuantity(item.min_quantity)}+` : "Any"),
    },
    ...(canManage
      ? [
          {
            key: "remove",
            header: "",
            align: "end" as const,
            render: (item: PriceListItem) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.variant?.product?.name ?? "price"}`}
                disabled={removePrice.isPending}
                onClick={async () => {
                  try {
                    await removePrice.mutateAsync([list.id, item.variant_id]);
                    toast.success("Price removed — it sells at the catalog price again");
                  } catch {
                    // Toasted by the hook.
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: "Name", value: list.name },
            { label: "Applies to", value: describeScope(list) },
            { label: "Priority", value: String(list.priority) },
            { label: "Status", value: list.is_active ? "In use" : "Off" },
          ]}
        />
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {canManage && <SetPriceForm listId={list.id} currency={list.currency} />}

      <DataTable
        columns={columns}
        rows={list.items ?? []}
        rowKey={(item) => item.id}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No prices on this list yet.
          </p>
        }
        mobileCardTitle={(item) => item.variant?.product?.name ?? "—"}
        mobileCardFields={[{ key: "price", label: "Price", render: (item) => money(item.price) }]}
      />

      <PriceListDialog list={list} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${list.name}?`}
        description="Everything on it goes back to its catalog price."
        confirmLabel="Delete list"
        destructive
        loading={removeList.isPending}
        onConfirm={async () => {
          try {
            await removeList.mutateAsync([list.id]);
            toast.success("Price list deleted");
            router.replace("/price-lists");
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </div>
  );
}

function SetPriceForm({ listId, currency }: { listId: string; currency: string }) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const { rows: products, isFetching } = useProductsList({ q: debounced || undefined });
  const put = usePutListPrice();

  const options = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      value: variant.id,
      label:
        (product.variants?.length ?? 0) > 1 ? `${product.name} — ${variant.name}` : product.name,
      description: variant.price ? `Catalog ${formatMoney(variant.price, currency)}` : undefined,
    })),
  );

  return (
    <Formik
      initialValues={{ variant_id: "", price: "", min_quantity: "" }}
      validationSchema={Yup.object({
        variant_id: Yup.string().required("Pick a product"),
        price: Yup.number().typeError("Enter a price").min(0).required("Enter a price"),
      })}
      onSubmit={async (values, helpers) => {
        try {
          await put.mutateAsync([
            listId,
            {
              variant_id: values.variant_id,
              price: String(values.price),
              // Omitted rather than null: no break means "from one".
              ...(values.min_quantity ? { min_quantity: String(values.min_quantity) } : {}),
            },
          ]);
          toast.success("Price set");
          helpers.resetForm();
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({ error, values, setErrors: helpers.setErrors });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="grid items-end gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <FormSearchSelectField
            name="variant_id"
            label="Product"
            placeholder="Pick a product"
            searchPlaceholder="Search the catalog…"
            options={options}
            onSearchChange={setSearch}
            loading={isFetching}
          />
          <FormNumberField name="price" label="Price" min={0} suffix={currency} />
          <FormNumberField name="min_quantity" label="From qty" min={0} hint="Blank for any." />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Set price
          </Button>
        </Form>
      )}
    </Formik>
  );
}
