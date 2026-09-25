"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStockItem, useStockLedger, useUpdateStockSettings } from "@/hooks/queries/useInventory";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDateTime, formatMoney, formatQuantity, formatSigned, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { StockItem, StockMove } from "@/types/api/inventory";

import { StockAdjustDialog, type StockAdjustMode } from "./StockAdjustDialog";

/** A stock row is one product at one branch, so its sheet key carries both. */
export function stockSheetKey(item: Pick<StockItem, "branch_id" | "variant_id">) {
  return `${item.branch_id}~${item.variant_id}`;
}

function parseKey(key: string | null) {
  const [branchId, variantId] = key?.split("~") ?? [];
  return { branchId: branchId || undefined, variantId: variantId || undefined };
}

/**
 * One product at one branch: the levels, where they came from (the move
 * ledger, newest first), and the reorder settings that drive the low-stock
 * flag and reorder suggestions.
 */
export function StockItemSheet({
  sheetKey,
  onClose,
}: {
  sheetKey: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { branchId, variantId } = parseKey(sheetKey);
  const { data: item, isLoading, error, refetch } = useStockItem(branchId, variantId);
  const [mode, setMode] = useState<StockAdjustMode | null>(null);

  const productName = item?.variant?.product?.name ?? item?.variant?.name;

  return (
    <>
      <DetailSheet
        open={!!sheetKey}
        onOpenChange={(open) => !open && onClose()}
        eyebrow={item?.branch?.name ?? "Stock"}
        title={productName ?? undefined}
        description={item?.variant?.sku ? `SKU ${item.variant.sku}` : undefined}
        status={item?.below_reorder_point && <Badge variant="secondary">Below reorder point</Badge>}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this stock line"
        actions={
          item && (
            <div className="flex flex-wrap gap-2">
              {can("stock:adjust") && (
                <Button size="sm" variant="outline" onClick={() => setMode("adjust")}>
                  Adjust
                </Button>
              )}
              {can("stock:wastage") && (
                <Button size="sm" variant="outline" onClick={() => setMode("write_off")}>
                  Write off
                </Button>
              )}
            </div>
          )
        }
      >
        {item && (
          <Tabs defaultValue="levels">
            <TabsList variant="line">
              <TabsTrigger value="levels">Levels</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              {can("reorder:manage") && <TabsTrigger value="reorder">Reordering</TabsTrigger>}
            </TabsList>

            <TabsContent value="levels" className="pt-3">
              <DescriptionList
                items={[
                  { label: "On hand", value: formatQuantity(item.on_hand) },
                  { label: "Reserved", value: formatQuantity(item.reserved) },
                  {
                    label: "Available to sell",
                    value: <span className="font-semibold">{formatQuantity(item.available)}</span>,
                  },
                  { label: "On order", value: formatQuantity(item.incoming) },
                  {
                    label: "Average cost",
                    value: formatMoney(item.average_cost, currency),
                    hidden: !can("valuation:view"),
                  },
                  {
                    label: "Value",
                    value: formatMoney(item.value, currency),
                    hidden: !can("valuation:view"),
                  },
                  { label: "Reorder point", value: formatQuantity(item.reorder_point) },
                  { label: "Bin", value: item.bin_location },
                  { label: "Last moved", value: formatDateTime(item.last_movement_at) },
                  { label: "Last counted", value: formatDateTime(item.last_counted_at) },
                ]}
              />
            </TabsContent>

            <TabsContent value="history" className="pt-3">
              <StockLedger branchId={item.branch_id} variantId={item.variant_id} />
            </TabsContent>

            <TabsContent value="reorder" className="pt-3">
              <ReorderSettingsForm item={item} />
            </TabsContent>
          </Tabs>
        )}
      </DetailSheet>

      <StockAdjustDialog
        item={mode ? (item ?? null) : null}
        mode={mode ?? "adjust"}
        onOpenChange={(open) => !open && setMode(null)}
      />
    </>
  );
}

function StockLedger({ branchId, variantId }: { branchId: string; variantId: string }) {
  const { data, isLoading, error, refetch } = useStockLedger(branchId, variantId);
  const moves = [...(data ?? [])].reverse();

  const columns: DataTableColumn<StockMove>[] = [
    {
      key: "kind",
      header: "Move",
      render: (move) => (
        <div>
          <p>{humanize(move.kind)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(move.occurred_at)}
            {move.actor?.label && ` · ${move.actor.label}`}
          </p>
          {(move.reason || move.note) && (
            <p className="text-xs text-muted-foreground">{move.note ?? humanize(move.reason!)}</p>
          )}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Change",
      align: "end",
      render: (move) => formatSigned(move.quantity),
    },
    {
      key: "balance",
      header: "After",
      align: "end",
      render: (move) => formatQuantity(move.balance_after),
    },
  ];

  return (
    <DataTable
      embedded
      columns={columns}
      rows={moves}
      rowKey={(move) => move.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={<p className="p-6 text-center text-sm text-muted-foreground">No movements yet.</p>}
      mobileCardTitle={(move) => humanize(move.kind)}
      mobileCardSubtitle={(move) => formatDateTime(move.occurred_at)}
      mobileCardFields={[
        { key: "qty", label: "Change", render: (move) => formatSigned(move.quantity) },
        { key: "after", label: "After", render: (move) => formatQuantity(move.balance_after) },
      ]}
    />
  );
}

const settingsSchema = Yup.object({
  reorder_point: Yup.number().typeError("Enter a number").min(0, "Can't be negative"),
  reorder_quantity: Yup.number().typeError("Enter a number").positive("Order more than zero"),
  max_stock: Yup.number().typeError("Enter a number").positive("Must be above zero"),
  bin_location: Yup.string().max(40, "Keep it under 40 characters"),
});

function ReorderSettingsForm({ item }: { item: StockItem }) {
  const update = useUpdateStockSettings();
  const blankIfNull = (value: string | null) => value ?? "";

  return (
    <Formik
      initialValues={{
        reorder_point: blankIfNull(item.reorder_point),
        reorder_quantity: blankIfNull(item.reorder_quantity),
        max_stock: blankIfNull(item.max_stock),
        bin_location: blankIfNull(item.bin_location),
      }}
      enableReinitialize
      validationSchema={settingsSchema}
      onSubmit={async (values, helpers) => {
        const orNull = (value: string | number) => (value === "" ? null : String(value));
        try {
          await update.mutateAsync([
            item.branch_id,
            item.variant_id,
            {
              reorder_point: orNull(values.reorder_point),
              reorder_quantity: orNull(values.reorder_quantity),
              max_stock: orNull(values.max_stock),
              bin_location: values.bin_location || null,
            },
          ]);
          toast.success("Reorder settings saved");
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
      {({ isSubmitting, dirty }) => (
        <Form className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            When available stock falls to the reorder point, this line shows as low and is suggested
            for reordering. Leave blank to never flag it.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormNumberField name="reorder_point" label="Reorder point" min={0} />
            <FormNumberField name="reorder_quantity" label="Order this many" min={0} />
            <FormNumberField name="max_stock" label="Most to hold" min={0} />
            <FormTextField name="bin_location" label="Bin / shelf" />
          </div>
          <div>
            <Button type="submit" disabled={isSubmitting || !dirty}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
