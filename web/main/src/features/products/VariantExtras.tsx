"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddBarcode,
  useAttachModifierGroup,
  useDeleteBarcode,
  useDetachModifierGroup,
  useGenerateVariantMatrix,
  useModifierGroups,
  useOptionTypes,
} from "@/hooks/queries/useCatalogSetup";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { BARCODE_KINDS, type Product, type ProductVariant } from "@/types/api/catalog";

/**
 * Every combination of the chosen values as a variant — three sizes and
 * four colours are twelve variants, not twelve forms. Combinations that
 * already exist are skipped, so adding a colour later builds only the new
 * column.
 */
export function VariantMatrixDialog({
  productId,
  defaultPrice,
  open,
  onOpenChange,
}: {
  productId: string;
  /** Each new variant starts at this — the product's own price. */
  defaultPrice?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: types } = useOptionTypes();
  const generate = useGenerateVariantMatrix();
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [price, setPrice] = useState("");
  // Typed, or the product's own price — read at send time, since the
  // product's variants may still be loading when the dialog first renders.
  const effectivePrice = price || defaultPrice || "";

  const groups = Object.values(picked).filter((ids) => ids.length > 0);
  const count = groups.length ? groups.reduce((total, ids) => total * ids.length, 1) : 0;

  const toggle = (typeId: string, valueId: string) =>
    setPicked((current) => {
      const ids = current[typeId] ?? [];
      return {
        ...current,
        [typeId]: ids.includes(valueId) ? ids.filter((id) => id !== valueId) : [...ids, valueId],
      };
    });

  const close = () => {
    setPicked({});
    setPrice("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Build variants from options</DialogTitle>
          <DialogDescription>
            Pick the values this product comes in. Options are set up under Catalog set-up.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
          {(types ?? []).map((type) => (
            <fieldset key={type.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{type.name}</legend>
              <div className="flex flex-wrap gap-1.5">
                {(type.values ?? []).map((value) => {
                  const on = (picked[type.id] ?? []).includes(value.id);
                  return (
                    <Button
                      key={value.id}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      onClick={() => toggle(type.id, value.id)}
                    >
                      {value.value}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {(types ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No options yet — add Size or Colour under Catalog set-up first.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="matrix-price">Price for each ({currency})</Label>
          <Input
            id="matrix-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={defaultPrice ?? "0"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            // The backend needs a price for every variant it builds.
            disabled={count === 0 || effectivePrice === "" || generate.isPending}
            onClick={async () => {
              try {
                const created = (await generate.mutateAsync([
                  productId,
                  groups,
                  { price: effectivePrice },
                ])) as ProductVariant[];
                toast.success(
                  created.length
                    ? `${created.length} variant${created.length === 1 ? "" : "s"} added`
                    : "Those variants already exist",
                );
                close();
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            {generate.isPending && <Loader2 className="size-4 animate-spin" />}
            {count ? `Build ${count} variant${count === 1 ? "" : "s"}` : "Build variants"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The extra barcodes a variant scans under — a supplier's code, an old label. */
export function VariantBarcodesDialog({
  variant,
  onOpenChange,
}: {
  variant: ProductVariant | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermission();
  const add = useAddBarcode();
  const remove = useDeleteBarcode();
  const [barcode, setBarcode] = useState("");
  const [kind, setKind] = useState<string>("ean13");

  return (
    <Dialog open={!!variant} onOpenChange={onOpenChange}>
      {variant && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Barcodes for {variant.name ?? "this variant"}</DialogTitle>
            <DialogDescription>
              Its own barcode is {variant.barcode ?? "not set"}. Any of these scan to it as well.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(variant.barcodes ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 p-2">
                <code className="flex-1 font-mono">{entry.barcode}</code>
                <Badge variant="outline">{entry.kind.toUpperCase()}</Badge>
                {can("barcode:manage") && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove barcode ${entry.barcode}`}
                    disabled={remove.isPending}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync([entry.id]);
                        toast.success("Barcode removed");
                      } catch {
                        // Toasted by the hook.
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
            {(variant.barcodes ?? []).length === 0 && (
              <li className="p-2 text-muted-foreground">No extra barcodes.</li>
            )}
          </ul>
          {can("barcode:manage") && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!barcode.trim()) return;
                try {
                  await add.mutateAsync([variant.id, { barcode: barcode.trim(), kind }]);
                  toast.success("Barcode added");
                  setBarcode("");
                } catch {
                  // Toasted by the hook — e.g. the barcode is already in use.
                }
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="new-barcode">Barcode</Label>
                <Input
                  id="new-barcode"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Scan or type"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="barcode-kind">Type</Label>
                <Select
                  items={BARCODE_KINDS.map((value) => ({ value, label: value.toUpperCase() }))}
                  value={kind}
                  onValueChange={(value: string | null) => setKind(value ?? "ean13")}
                >
                  <SelectTrigger id="barcode-kind" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BARCODE_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="outline" disabled={!barcode.trim() || add.isPending}>
                Add
              </Button>
            </form>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Add-on groups offered with this product at the till. */
export function ProductModifiersSection({ product }: { product: Product }) {
  const { can } = usePermission();
  const canManage = can("modifier:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: groups } = useModifierGroups(canManage);
  const attach = useAttachModifierGroup();
  const detach = useDetachModifierGroup();
  const [choice, setChoice] = useState("");

  const attached = product.modifier_groups ?? [];
  const available = (groups ?? []).filter((group) => !attached.some((a) => a.id === group.id));

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-sm font-medium">Add-ons</h2>
        <p className="text-xs text-muted-foreground">Choices the till offers with this product.</p>
      </div>
      <ul className="mb-3 flex flex-col gap-2">
        {attached.map((group) => (
          <li
            key={group.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <div>
              <p className="font-medium">{group.name}</p>
              <p className="text-xs text-muted-foreground">
                {(group.modifiers ?? [])
                  .map((modifier) =>
                    Number(modifier.price_delta ?? 0) > 0
                      ? `${modifier.name} +${formatMoney(modifier.price_delta, currency)}`
                      : modifier.name,
                  )
                  .join(", ") || "No choices yet"}
              </p>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                disabled={detach.isPending}
                onClick={async () => {
                  try {
                    await detach.mutateAsync([product.id, group.id]);
                    toast.success(`${group.name} removed`);
                  } catch {
                    // Toasted by the hook.
                  }
                }}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
        {attached.length === 0 && <li className="text-sm text-muted-foreground">None attached.</li>}
      </ul>
      {canManage && available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={available.map((group) => ({ value: group.id, label: group.name }))}
            value={choice}
            onValueChange={(value: string | null) => setChoice(value ?? "")}
          >
            <SelectTrigger className="w-56" aria-label="Add-on group to attach">
              <SelectValue placeholder="Pick a group" />
            </SelectTrigger>
            <SelectContent>
              {available.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!choice || attach.isPending}
            onClick={async () => {
              try {
                await attach.mutateAsync([product.id, choice]);
                toast.success("Add-ons attached");
                setChoice("");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            Attach
          </Button>
        </div>
      )}
    </section>
  );
}
