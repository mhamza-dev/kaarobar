"use client";

import { Loader2, PackageSearch, ScanLine, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { formatMoney } from "@/lib/format";
import { isTypingTarget } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { listProducts } from "@/services/products";
import { scanBarcode } from "@/services/sales";
import type { Product, ProductVariant } from "@/types/api/catalog";

export type PickedProduct = { variantId: string; name: string; unitPrice: string | null };

/** Products per page of the grid — enough to fill a wide till twice over. */
const PAGE_SIZE = 48;

function sellableVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((variant) => variant.is_active !== false);
}

/** "From Rs 450" when the options are priced differently. */
function priceLabel(variants: ProductVariant[]) {
  const prices = variants.map((variant) => Number(variant.price ?? 0));
  const lowest = variants[prices.indexOf(Math.min(...prices))];
  const varied = new Set(prices).size > 1;
  return { lowest: lowest?.price ?? null, varied };
}

function variantName(product: Product, variant: ProductVariant) {
  return variant.name && variant.name !== product.name
    ? `${product.name} — ${variant.name}`
    : product.name;
}

/**
 * The till's catalog: one box that is both the barcode scanner and the
 * search, category chips, and a grid of products to tap.
 *
 * A hardware scanner is a keyboard that types fast and presses Enter, so
 * Enter means "look this up as a barcode" — falling back to the first
 * product shown — while typing narrows the grid. Picking anything puts the
 * focus back in the box, because the next scan is already on its way.
 */
export function ProductPicker({
  onPick,
  inBasket,
  currency,
  className,
}: {
  onPick: (product: PickedProduct) => void;
  currency: string;
  /** Quantity in the basket per variant, for the badge on each tile. */
  inBasket: Map<string, number>;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [choosing, setChoosing] = useState<Product | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(query.trim(), 250);

  const { data: categories } = useCategoriesList();
  const topCategories = useMemo(
    () =>
      (categories ?? [])
        .filter((item) => item.is_active && !item.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [categories],
  );

  // A search looks across the whole catalog; a category narrows the browse.
  const products = useProductsList({
    q: debounced || undefined,
    in_category_tree: debounced ? undefined : (category ?? undefined),
    active: true,
    limit: PAGE_SIZE,
  });
  const rows = products.rows.filter((product) => sellableVariants(product).length > 0);

  // "/" jumps to the scan box from anywhere on the till.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const done = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const pickVariant = (product: Product, variant: ProductVariant) => {
    onPick({
      variantId: variant.id,
      name: variantName(product, variant),
      unitPrice: variant.price,
    });
    setChoosing(null);
    done();
  };

  const pickProduct = (product: Product) => {
    const variants = sellableVariants(product);
    if (variants.length === 1) pickVariant(product, variants[0]);
    else setChoosing(product);
  };

  const handleEnter = async () => {
    const code = query.trim();
    if (!code) return;

    setScanning(true);
    try {
      const variant = await scanBarcode(code);
      onPick({
        variantId: variant.id,
        name: variant.product?.name ?? variant.name ?? code,
        unitPrice: variant.price,
      });
      done();
    } catch {
      // Not a barcode — take the first product that matches, which is what
      // a cashier typing a name expects Enter to do. If they pressed Enter
      // before the grid caught up with their typing, ask for it directly.
      try {
        const first =
          debounced === code
            ? rows[0]
            : (await listProducts({ q: code, active: true, limit: 1 })).data.find(
                (product) => sellableVariants(product).length > 0,
              );
        if (first) pickProduct(first);
        else toast.error(`Nothing found for "${code}"`);
      } catch (error) {
        toast.apiError(error);
      }
    } finally {
      setScanning(false);
    }
  };

  const showSkeleton = products.isLoading || (products.isFetching && rows.length === 0);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        {scanning ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ScanLine className="pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          value={query}
          autoFocus
          aria-label="Scan or search"
          placeholder="Scan a barcode, or search by name, SKU…"
          className="h-11 rounded-xl bg-card pr-20 pl-10 text-base shadow-xs md:text-[0.938rem]"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleEnter();
            } else if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={done}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          ) : (
            <kbd className="pointer-events-none hidden h-6 items-center rounded-md border border-border bg-muted px-2 font-sans text-xs font-medium text-muted-foreground md:inline-flex">
              /
            </kbd>
          )}
        </div>
      </div>

      {topCategories.length > 0 && !debounced && (
        <div
          role="group"
          aria-label="Categories"
          className="scrollbar-thin -mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {[{ id: null, name: "All" }, ...topCategories].map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(item.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-input hover:text-foreground",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="scrollbar-thin -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        {showSkeleton ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-[6.5rem] rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={debounced ? `Nothing matches "${debounced}"` : "No products here yet"}
            description={
              debounced
                ? "Try part of the name, or scan the barcode."
                : "Products you add to the catalog show up here, ready to tap."
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {rows.map((product) => {
                const variants = sellableVariants(product);
                const { lowest, varied } = priceLabel(variants);
                const count = variants.reduce(
                  (sum, variant) => sum + (inBasket.get(variant.id) ?? 0),
                  0,
                );
                const image = product.image_url ?? variants[0]?.image_url;

                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => pickProduct(product)}
                      className={cn(
                        "group relative flex h-full min-h-[6.5rem] w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-xs transition-[border-color,box-shadow,transform] outline-none hover:border-primary/40 hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
                        count > 0 ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
                      )}
                    >
                      <span className="flex items-start gap-2.5">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- catalog images come from any host
                          <img
                            src={image}
                            alt=""
                            className="size-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <InitialsAvatar
                            name={product.name}
                            shape="square"
                            className="size-10 text-sm"
                          />
                        )}
                        <span className="line-clamp-2 min-w-0 pt-0.5 text-sm leading-snug font-medium">
                          {product.name}
                        </span>
                      </span>
                      <span className="mt-auto flex items-end justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {varied && (
                            <span className="text-xs font-normal text-muted-foreground">from </span>
                          )}
                          {formatMoney(lowest, currency)}
                        </span>
                        {variants.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {variants.length} options
                          </span>
                        )}
                      </span>
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-5.5 min-w-5.5 animate-pop items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground shadow-xs">
                          <span className="sr-only">In basket: </span>
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {products.hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => products.fetchNextPage()}
                  disabled={products.isFetchingNextPage}
                >
                  {products.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                  Show more products
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!choosing} onOpenChange={(open) => !open && setChoosing(null)}>
        {choosing && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{choosing.name}</DialogTitle>
              <DialogDescription>Which one is it?</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {sellableVariants(choosing).map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => pickVariant(choosing, variant)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="text-sm font-medium">
                    {variant.name ?? variant.sku ?? "Default"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(variant.price, currency)}
                  </span>
                  {(inBasket.get(variant.id) ?? 0) > 0 && (
                    <span className="text-xs text-primary">
                      {inBasket.get(variant.id)} in basket
                    </span>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
