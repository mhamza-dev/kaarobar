"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMoney } from "@/lib/format";

export type CostLine = {
  variant_id: string;
  /** The product's name — also what a bill line is described as. */
  label: string;
  quantity: string;
  unit_cost: string;
};

/**
 * Product lines priced at cost: search the catalog, add, then set a
 * quantity and unit cost per line. Shared by everything bought from or sent
 * back to a supplier — purchase orders, bills, returns.
 *
 * The total shown is an estimate for the person typing; the backend
 * computes the real one (with tax) from the lines it receives.
 */
export function CostLinesEditor({
  lines,
  onChange,
  currency,
  label = "Add products",
}: {
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
  currency: string;
  label?: string;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { rows: products } = useProductsList({ q: debouncedSearch || undefined });

  const estimatedTotal = lines.reduce(
    (total, line) => total + Number(line.quantity || 0) * Number(line.unit_cost || 0),
    0,
  );

  const updateLine = (index: number, patch: Partial<CostLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={searchId}>{label}</Label>
        <Input
          id={searchId}
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
                  onClick={() => {
                    if (!lines.some((line) => line.variant_id === variant.id)) {
                      onChange([
                        ...lines,
                        {
                          variant_id: variant.id,
                          label: product.name,
                          quantity: "1",
                          // Seeded from the last known cost, which is what
                          // the buyer is about to check against the invoice.
                          unit_cost: variant.cost ?? "0",
                        },
                      ]);
                    }
                    setSearch("");
                  }}
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
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          {lines.map((line, index) => (
            <div key={line.variant_id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-40 flex-1 text-sm">{line.label}</span>
              <Input
                value={line.quantity}
                inputMode="decimal"
                aria-label={`Quantity for ${line.label}`}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
                className="w-24"
              />
              <Input
                value={line.unit_cost}
                inputMode="decimal"
                aria-label={`Unit cost for ${line.label}`}
                onChange={(event) => updateLine(index, { unit_cost: event.target.value })}
                className="w-28"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${line.label}`}
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex justify-end border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">Estimated total:&nbsp;</span>
            <span className="font-medium">{formatMoney(estimatedTotal.toFixed(2), currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lines with nothing to buy or send back are dropped rather than rejected. */
export function filledLines(lines: CostLine[]): CostLine[] {
  return lines.filter((line) => Number(line.quantity) > 0);
}
