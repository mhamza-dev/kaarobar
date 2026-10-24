"use client";

import { Minus, Plus, ShoppingBasket, Tag, X } from "lucide-react";

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
        icon={ShoppingBasket}
        title="Nothing scanned yet"
        description="Scan a barcode, or tap a product to start a sale."
        className="h-full"
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border/70">
      {lines.map((line) => {
        const quoted = quote?.lines.find((candidate) => candidate.variant_id === line.variantId);
        const discounted = quoted?.discounts.some((discount) => Number(discount.amount ?? 0) > 0);

        return (
          <li key={line.variantId} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {formatMoney(quoted?.unit_price ?? line.unitPrice, currency)} each
                </span>
                {discounted && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-success">
                    <Tag className="size-3" aria-hidden />
                    {quoted!.discounts[0]?.name ?? "Discount"}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center rounded-lg border border-border bg-background">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Decrease quantity of ${line.name}`}
                onClick={() => onSetQuantity(line.variantId, line.quantity - 1)}
                className="rounded-r-none"
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {line.quantity}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Increase quantity of ${line.name}`}
                onClick={() => onSetQuantity(line.variantId, line.quantity + 1)}
                className="rounded-l-none"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <span className="w-20 text-right text-sm font-semibold tabular-nums">
              {quoted ? formatMoney(quoted.total, currency) : "…"}
            </span>

            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${line.name}`}
              onClick={() => onRemove(line.variantId)}
              className="-mr-1 text-muted-foreground hover:text-danger"
            >
              <X />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
