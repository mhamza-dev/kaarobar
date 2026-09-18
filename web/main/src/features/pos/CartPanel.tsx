"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { CartLine } from "@/stores/cart";
import type { SaleQuote } from "@/types/api/sales";

/**
 * The basket.
 *
 * Line money comes from the quote, matched by variant — never from
 * `line.unitPrice`, which is only a catalog hint used before the first
 * quote lands. A promotion or price list can make the real line total
 * differ from quantity × shelf price, and the receipt will show the
 * backend's figure regardless.
 */
export function CartPanel({
  lines,
  quote,
  currency,
  onSetQuantity,
  onRemove,
}: {
  lines: CartLine[];
  quote: SaleQuote | undefined;
  currency: string;
  onSetQuantity: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Nothing scanned yet"
        description="Scan a barcode or search for a product to start a sale."
      />
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {lines.map((line) => {
        const quoted = quote?.lines.find((candidate) => candidate.variant_id === line.variantId);

        return (
          <div key={line.variantId} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(quoted?.unit_price ?? line.unitPrice, currency)} each
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Decrease quantity of ${line.name}`}
                onClick={() => onSetQuantity(line.variantId, line.quantity - 1)}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Increase quantity of ${line.name}`}
                onClick={() => onSetQuantity(line.variantId, line.quantity + 1)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <span className="w-24 text-right text-sm font-medium tabular-nums">
              {quoted ? formatMoney(quoted.total, currency) : "…"}
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${line.name}`}
              onClick={() => onRemove(line.variantId)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
