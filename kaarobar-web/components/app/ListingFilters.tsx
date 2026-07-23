"use client";

import { X } from "lucide-react";
import { fieldClass } from "@/components/app/ui";

export type ListingFilterState = {
  search: string;
  categories: string[];
  priceMin: string;
  priceMax: string;
};

export const emptyListingFilters = (): ListingFilterState => ({
  search: "",
  categories: [],
  priceMin: "",
  priceMax: "",
});

export type ListingAccessors<T> = {
  searchText: (item: T) => string;
  category?: (item: T) => string | null | undefined;
  price?: (item: T) => number;
};

export function applyListingFilters<T>(
  items: T[],
  state: ListingFilterState,
  accessors: ListingAccessors<T>
): T[] {
  const q = state.search.trim().toLowerCase();
  const min = state.priceMin.trim() === "" ? null : Number(state.priceMin);
  const max = state.priceMax.trim() === "" ? null : Number(state.priceMax);
  const cats = new Set(state.categories.map((c) => c.toLowerCase()));

  return items.filter((item) => {
    if (q) {
      const hay = accessors.searchText(item).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (cats.size > 0 && accessors.category) {
      const cat = (accessors.category(item) || "").toLowerCase();
      if (!cats.has(cat)) return false;
    }
    if (accessors.price && (min !== null || max !== null)) {
      const price = accessors.price(item);
      if (!Number.isFinite(price)) return false;
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
    }
    return true;
  });
}

export type ListingFiltersProps = {
  value: ListingFilterState;
  onChange: (next: ListingFilterState) => void;
  /** Category / industry option labels */
  categoryOptions?: string[];
  categoryLabel?: string;
  showPrice?: boolean;
  searchPlaceholder?: string;
  className?: string;
};

/** Compact controlled toolbar: search, category chips, optional price range. */
export default function ListingFilters({
  value,
  onChange,
  categoryOptions = [],
  categoryLabel = "Category",
  showPrice = true,
  searchPlaceholder = "Search…",
  className = "",
}: ListingFiltersProps) {
  const active =
    value.search.trim() !== "" ||
    value.categories.length > 0 ||
    value.priceMin.trim() !== "" ||
    value.priceMax.trim() !== "";

  function toggleCategory(cat: string) {
    const has = value.categories.includes(cat);
    onChange({
      ...value,
      categories: has
        ? value.categories.filter((c) => c !== cat)
        : [...value.categories, cat],
    });
  }

  return (
    <div
      className={`space-y-3 rounded-md border border-border bg-bg-secondary/60 p-3 sm:p-4 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
            Search
          </span>
          <input
            type="search"
            className={fieldClass}
            placeholder={searchPlaceholder}
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
          />
        </label>
        {showPrice ? (
          <>
            <label className="w-28">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
                Min price
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
                placeholder="0"
                value={value.priceMin}
                onChange={(e) => onChange({ ...value, priceMin: e.target.value })}
              />
            </label>
            <label className="w-28">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
                Max price
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
                placeholder="∞"
                value={value.priceMax}
                onChange={(e) => onChange({ ...value, priceMax: e.target.value })}
              />
            </label>
          </>
        ) : null}
        {active ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-body hover:bg-bg-hover"
            onClick={() => onChange(emptyListingFilters())}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
      {categoryOptions.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            {categoryLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((cat) => {
              const on = value.categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "bg-brand text-brand-foreground"
                      : "border border-border bg-card text-heading hover:border-brand/40"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
