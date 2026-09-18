"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
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
import { Label } from "@/components/ui/label";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useCreateTransfer } from "@/hooks/queries/useStockOperations";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import type { StockTransfer } from "@/types/api/inventory";

type Line = { variant_id: string; label: string; quantity: string };

const schema = Yup.object({
  source_branch_id: Yup.string().required("Pick where the stock leaves from"),
  destination_branch_id: Yup.string()
    .required("Pick where it is going")
    .notOneOf([Yup.ref("source_branch_id")], "Pick a different destination"),
});

/**
 * Creating a transfer. Lines are held in local state rather than Formik:
 * they are a list built by searching the catalog, not a fixed set of fields,
 * and Yup has nothing useful to say about them beyond "there is at least one".
 */
export function TransferCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: branches } = useBranchesList();
  const createTransfer = useCreateTransfer();

  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { rows: products } = useProductsList({ q: debouncedSearch || undefined });

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const addLine = (variantId: string, label: string) => {
    if (lines.some((line) => line.variant_id === variantId)) return;
    setLines((current) => [...current, { variant_id: variantId, label, quantity: "1" }]);
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setLines([]);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
          <DialogDescription>
            Nothing moves yet — a transfer is created as a draft, then dispatched and received.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{ source_branch_id: "", destination_branch_id: "", notes: "" }}
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            if (lines.length === 0) {
              toast.error("Add at least one product to transfer");
              return;
            }

            try {
              const transfer = (await createTransfer.mutateAsync([
                {
                  source_branch_id: values.source_branch_id,
                  destination_branch_id: values.destination_branch_id,
                  notes: values.notes || undefined,
                  items: lines.map((line) => ({
                    variant_id: line.variant_id,
                    quantity: line.quantity,
                  })),
                },
              ])) as StockTransfer;

              toast.success(`Transfer ${transfer.number} created`);
              onOpenChange(false);
              setLines([]);
              router.push(`/stock-transfers/${transfer.id}`);
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
                <FormSelectField name="source_branch_id" label="From" options={branchOptions} />
                <FormSelectField name="destination_branch_id" label="To" options={branchOptions} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="transfer-search">Add products</Label>
                <Input
                  id="transfer-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search the catalog…"
                />
                {search && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {products.slice(0, 8).map((product) => {
                      const variant = product.variants?.[0];
                      if (!variant) return null;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addLine(variant.id, product.name)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>{product.name}</span>
                          <Plus className="size-3.5" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {lines.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
                  {lines.map((line, index) => (
                    <div key={line.variant_id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{line.label}</span>
                      <Input
                        value={line.quantity}
                        inputMode="decimal"
                        aria-label={`Quantity for ${line.label}`}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((l, i) =>
                              i === index ? { ...l, quantity: event.target.value } : l,
                            ),
                          )
                        }
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${line.label}`}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <FormTextareaField name="notes" label="Notes" rows={2} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Create transfer
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
