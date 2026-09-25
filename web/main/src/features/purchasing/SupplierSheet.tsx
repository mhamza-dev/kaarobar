"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useArchiveSupplier,
  useSupplier,
  useSupplierLedger,
  useSupplierProducts,
} from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatSigned,
  humanize,
} from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { SupplierLedgerEntry, SupplierProduct } from "@/types/api/purchasing";

import { SupplierDialog } from "./SupplierDialog";
import { SupplierPaymentDialog } from "./SupplierPaymentDialog";
import { SupplierProductDialog } from "./SupplierProductDialog";

/**
 * One supplier at a glance, over the suppliers list: who they are, what
 * they sell you and at what price, and the running account of what you owe.
 */
export function SupplierSheet({
  supplierId,
  onClose,
}: {
  supplierId: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: supplier, isLoading, error, refetch } = useSupplier(supplierId);
  const archive = useArchiveSupplier();

  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const currency = supplier?.currency ?? fallbackCurrency;

  return (
    <>
      <DetailSheet
        open={!!supplierId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Supplier"
        title={supplier?.name}
        status={supplier && !supplier.is_active && <Badge variant="outline">Archived</Badge>}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this supplier"
        actions={
          supplier && (
            <div className="flex flex-wrap gap-2">
              {can("supplier:edit") && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              )}
              {can("supplier_payment:record") && supplier.is_active && (
                <SupplierPaymentDialog supplierId={supplier.id} trigger="Pay" />
              )}
              {can("supplier:archive") && supplier.is_active && (
                <Button variant="ghost" size="sm" onClick={() => setArchiving(true)}>
                  Archive
                </Button>
              )}
            </div>
          )
        }
      >
        {supplier && (
          <Tabs defaultValue="details">
            <TabsList variant="line">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-3">
              <DescriptionList
                items={[
                  {
                    label: "Owed",
                    value: (
                      <span className="font-semibold">
                        {formatMoney(supplier.balance, currency)}
                      </span>
                    ),
                  },
                  { label: "Contact", value: supplier.contact_name },
                  { label: "Phone", value: supplier.phone },
                  { label: "Email", value: supplier.email },
                  {
                    label: "Address",
                    value: [supplier.address?.line1, supplier.address?.city]
                      .filter(Boolean)
                      .join(", "),
                  },
                  {
                    label: "Payment terms",
                    value:
                      supplier.payment_terms_days == null
                        ? null
                        : `${supplier.payment_terms_days} days`,
                  },
                  {
                    label: "Credit limit",
                    value: supplier.credit_limit
                      ? formatMoney(supplier.credit_limit, currency)
                      : null,
                  },
                  { label: "Tax number", value: supplier.tax_number },
                  { label: "Code", value: supplier.code },
                ]}
              />
              {supplier.notes && (
                <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">{supplier.notes}</p>
              )}
            </TabsContent>

            <TabsContent value="products" className="pt-3">
              <SupplierProducts supplierId={supplier.id} currency={currency} />
            </TabsContent>

            <TabsContent value="account" className="pt-3">
              <SupplierAccount supplierId={supplier.id} currency={currency} />
            </TabsContent>
          </Tabs>
        )}
      </DetailSheet>

      {supplier && (
        <>
          <SupplierDialog open={editing} onOpenChange={setEditing} supplier={supplier} />
          <ConfirmDialog
            open={archiving}
            onOpenChange={setArchiving}
            title={`Archive ${supplier.name}?`}
            description="Their purchase history stays. They won't appear when raising new orders."
            confirmLabel="Archive supplier"
            destructive
            loading={archive.isPending}
            onConfirm={async () => {
              try {
                await archive.mutateAsync([supplier.id]);
                toast.success("Supplier archived");
                setArchiving(false);
              } catch {
                // Toasted by the hook.
              }
            }}
          />
        </>
      )}
    </>
  );
}

function SupplierProducts({ supplierId, currency }: { supplierId: string; currency: string }) {
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useSupplierProducts(supplierId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const canEdit = can("supplier:edit");

  const columns: DataTableColumn<SupplierProduct>[] = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div>
          <p className="font-medium">{row.variant?.product?.name ?? row.variant?.name ?? "—"}</p>
          {row.supplier_sku && (
            <p className="text-xs text-muted-foreground">Their code {row.supplier_sku}</p>
          )}
        </div>
      ),
    },
    {
      key: "cost",
      header: "Price",
      align: "end",
      render: (row) => formatMoney(row.unit_cost, currency),
    },
    {
      key: "lead",
      header: "Lead time",
      align: "end",
      render: (row) => (row.lead_time_days == null ? "—" : `${row.lead_time_days} d`),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add product
          </Button>
        </div>
      )}
      <DataTable
        embedded
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        onRowClick={
          canEdit
            ? (row) => {
                setEditing(row);
                setDialogOpen(true);
              }
            : undefined
        }
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No prices recorded for this supplier yet.
          </p>
        }
        mobileCardTitle={(row) => row.variant?.product?.name ?? "—"}
        mobileCardFields={[
          { key: "cost", label: "Price", render: (row) => formatMoney(row.unit_cost, currency) },
          {
            key: "moq",
            label: "Minimum",
            render: (row) => formatQuantity(row.minimum_order_quantity),
          },
        ]}
      />
      <SupplierProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplierId={supplierId}
        editing={editing}
        currency={currency}
      />
    </div>
  );
}

function SupplierAccount({ supplierId, currency }: { supplierId: string; currency: string }) {
  const { data, isLoading, error, refetch } = useSupplierLedger(supplierId);
  // Newest first reads better; the backend returns the ledger in order.
  const entries = [...(data?.entries ?? [])].reverse();

  const columns: DataTableColumn<SupplierLedgerEntry>[] = [
    {
      key: "when",
      header: "When",
      render: (entry) => (
        <div>
          <p>{humanize(entry.kind)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurred_at)}</p>
        </div>
      ),
    },
    { key: "note", header: "Note", render: (entry) => entry.note ?? "—" },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (entry) => formatSigned(entry.amount),
    },
    {
      key: "balance",
      header: "Owed after",
      align: "end",
      render: (entry) => formatMoney(entry.balance_after, currency),
    },
  ];

  return (
    <DataTable
      embedded
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={
        <p className="p-6 text-center text-sm text-muted-foreground">Nothing billed or paid yet.</p>
      }
      mobileCardTitle={(entry) => humanize(entry.kind)}
      mobileCardSubtitle={(entry) => formatDate(entry.occurred_at)}
      mobileCardFields={[
        { key: "amount", label: "Amount", render: (entry) => formatSigned(entry.amount) },
        {
          key: "balance",
          label: "Owed after",
          render: (entry) => formatMoney(entry.balance_after, currency),
        },
      ]}
    />
  );
}
