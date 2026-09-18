"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateVariant, useDeleteVariant, useVariants } from "@/hooks/queries/useProducts";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { ProductVariant } from "@/types/api/catalog";

/**
 * Variants live as an expandable section on the product page rather than a
 * route of their own — a variant has no meaning apart from its product, and
 * a separate screen would mean navigating away mid-edit.
 *
 * Prices are strings the whole way through (the backend renders money as a
 * string on purpose); nothing here does arithmetic on them.
 */
export function VariantsSection({ productId }: { productId: string }) {
  const { data: variants, isLoading, error, refetch } = useVariants(productId);
  const createVariant = useCreateVariant(productId);
  const deleteVariant = useDeleteVariant(productId);

  const [adding, setAdding] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProductVariant | null>(null);
  const { can } = usePermission();

  // Cost and margin are deliberately a separate permission from seeing the
  // product at all — a cashier may look up a price without seeing what the
  // shop paid for it.
  const canManage = can("variant:manage");
  const canSeeCost = can("product:cost_view");

  const reset = () => {
    setSku("");
    setName("");
    setPrice("");
    setAdding(false);
  };

  const columns: DataTableColumn<ProductVariant>[] = [
    {
      key: "name",
      header: "Variant",
      render: (variant) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{variant.name ?? "Default"}</span>
          {variant.is_default && <Badge variant="secondary">Default</Badge>}
          {!variant.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    { key: "sku", header: "SKU", render: (variant) => variant.sku ?? "—" },
    { key: "barcode", header: "Barcode", render: (variant) => variant.barcode ?? "—" },
    { key: "price", header: "Price", align: "end", render: (variant) => variant.price ?? "—" },
    ...(canSeeCost
      ? [
          {
            key: "cost",
            header: "Cost",
            align: "end" as const,
            render: (variant: ProductVariant) => variant.cost ?? "—",
          },
        ]
      : []),
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-12",
      render: (variant) =>
        variant.is_default || !canManage ? null : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${variant.name ?? "variant"}`}
            onClick={() => setPendingDelete(variant)}
          >
            <Trash2 className="size-4" />
          </Button>
        ),
    },
  ];

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Variants</h2>
          <p className="text-xs text-muted-foreground">
            What actually sells — each variant carries its own SKU, barcode and price.
          </p>
        </div>
        {!adding && canManage && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add variant
          </Button>
        )}
      </div>

      {adding && canManage && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variant-name">Name</Label>
            <Input
              id="variant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Large"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variant-sku">SKU</Label>
            <Input id="variant-sku" value={sku} onChange={(event) => setSku(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variant-price">Price</Label>
            <Input
              id="variant-price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={createVariant.isPending}
              onClick={async () => {
                try {
                  await createVariant.mutateAsync([
                    productId,
                    {
                      name: name || null,
                      sku: sku || null,
                      price: price || null,
                    },
                  ]);
                  toast.success("Variant added");
                  reset();
                } catch {
                  // Toasted by the hook; keep what was typed.
                }
              }}
            >
              {createVariant.isPending && <Loader2 className="size-4 animate-spin" />}
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={variants ?? []}
        rowKey={(variant) => variant.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        embedded={false}
        mobileCardTitle={(variant) => variant.name ?? "Default"}
        mobileCardSubtitle={(variant) => variant.sku ?? ""}
        mobileCardFields={[
          { key: "price", label: "Price", render: (variant) => variant.price ?? "—" },
        ]}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "this variant"}?`}
        description="Past sales keep their record of it. You can't undo this."
        confirmLabel="Delete variant"
        destructive
        loading={deleteVariant.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteVariant.mutateAsync([pendingDelete.id]);
            toast.success("Variant deleted");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </section>
  );
}
