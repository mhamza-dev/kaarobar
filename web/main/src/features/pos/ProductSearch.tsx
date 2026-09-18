"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { scanBarcode } from "@/services/sales";
import { formatMoney } from "@/lib/format";

export type ScannedProduct = { variantId: string; name: string; unitPrice: string | null };

/**
 * The till's one input: search box and barcode scanner in the same field.
 *
 * A hardware scanner is a keyboard that types fast and presses Enter, so
 * Enter means "look this up as a barcode" while typing means "search". On a
 * successful scan the field clears itself immediately, because the next
 * scan is already arriving.
 */
export function ProductSearch({ onPick }: { onPick: (product: ScannedProduct) => void }) {
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(query, 250);
  const { rows: products, isFetching } = useProductsList({ q: debounced || undefined });

  const pick = (variantId: string, name: string, unitPrice: string | null) => {
    onPick({ variantId, name, unitPrice });
    setQuery("");
    inputRef.current?.focus();
  };

  const handleScan = async () => {
    const barcode = query.trim();
    if (!barcode) return;

    setScanning(true);
    try {
      const variant = await scanBarcode(barcode);
      pick(variant.id, variant.product?.name ?? variant.name ?? barcode, variant.price);
    } catch {
      // Not a barcode — fall back to the first search result, which is what
      // a cashier typing a product name expects Enter to do.
      const first = products[0];
      const variant = first?.variants?.[0];
      if (variant) pick(variant.id, first.name, variant.price);
      else toast.error(`Nothing found for "${barcode}"`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus
          aria-label="Scan or search"
          placeholder="Scan a barcode, or search by name…"
          className="pl-8"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleScan();
            }
          }}
          disabled={scanning}
        />
      </div>

      {query && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {products.length === 0 && !isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No products match.</p>
          ) : (
            products.slice(0, 10).map((product) => {
              const variant = product.variants?.[0];
              if (!variant) return null;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => pick(variant.id, product.name, variant.price)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{product.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatMoney(variant.price)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
