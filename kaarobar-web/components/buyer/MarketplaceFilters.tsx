"use client";

import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import MarketplaceFilterDrawer from "@/components/buyer/MarketplaceFilterDrawer";
import { useT } from "@/lib/i18n";
import {
  countMarketplaceAdvancedFilters,
  emptyMarketplaceFeedFilters,
  type MarketplaceFeedFilters,
} from "@/lib/marketplaceFeed";

type Props = {
  value: MarketplaceFeedFilters;
  onChange: (next: MarketplaceFeedFilters) => void;
  categoryOptions: string[];
  industryOptions: string[];
  resultCount?: number;
  searchPlaceholder?: string;
  className?: string;
};

/** Buyer marketplace sticky search + Filters drawer (Discover / Products). */
export default function MarketplaceFilters({
  value,
  onChange,
  categoryOptions,
  industryOptions,
  resultCount,
  searchPlaceholder,
  className = "",
}: Props) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const advancedCount = countMarketplaceAdvancedFilters(value);
  const showFilterButton = true;
  const hasSearch = value.search.trim() !== "";
  const hasAdvanced = advancedCount > 0;

  function removeCategory(cat: string) {
    onChange({
      ...value,
      categories: value.categories.filter((c) => c !== cat),
    });
  }

  function removeIndustry(ind: string) {
    onChange({
      ...value,
      industries: value.industries.filter((i) => i !== ind),
    });
  }

  function clearAdvanced() {
    onChange({
      ...value,
      categories: [],
      industries: [],
      priceMin: "",
      priceMax: "",
    });
  }

  function clearAll() {
    onChange(emptyMarketplaceFeedFilters());
  }

  return (
    <>
      {/* Sticky under buyer chrome: main is the scrollport, so top-0 (not header height). */}
      <div
        className={`sticky top-0 z-20 -mx-4 bg-bg-primary px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ${className}`}
      >
        <div className="space-y-3 rounded-md border border-border/80 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={value.search}
                onChange={(e) => onChange({ ...value, search: e.target.value })}
                placeholder={searchPlaceholder || t("marketplace.searchAllProducts")}
                className="w-full rounded-md border border-border bg-bg-primary py-3 pe-10 ps-10 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/20"
                aria-label={searchPlaceholder || t("marketplace.searchAllProducts")}
              />
              {value.search ? (
                <button
                  type="button"
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-bg-secondary hover:text-heading"
                  aria-label={t("listFilters.clearSearch")}
                  onClick={() => onChange({ ...value, search: "" })}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {showFilterButton ? (
              <Button
                type="button"
                variant={advancedCount > 0 ? "primary" : "outline"}
                size="sm"
                startIcon={<Filter className="h-3.5 w-3.5" />}
                onClick={() => setDrawerOpen(true)}
                aria-label={
                  advancedCount > 0
                    ? t("marketplace.filtersActive", { count: advancedCount })
                    : t("marketplace.filters")
                }
              >
                {t("marketplace.filters")}
                {advancedCount > 0 ? (
                  <span className="ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-foreground/20 px-1.5 text-[11px] font-bold tabular-nums">
                    {advancedCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
          </div>

          {hasAdvanced ? (
            <div className="flex flex-wrap items-center gap-2">
              {value.industries.map((ind) => (
                <SummaryChip
                  key={`ind:${ind}`}
                  label={ind}
                  onRemove={() => removeIndustry(ind)}
                  removeLabel={t("common.close")}
                />
              ))}
              {value.categories.map((cat) => (
                <SummaryChip
                  key={`cat:${cat}`}
                  label={cat}
                  onRemove={() => removeCategory(cat)}
                  removeLabel={t("common.close")}
                />
              ))}
              {value.priceMin.trim() || value.priceMax.trim() ? (
                <SummaryChip
                  label={`${t("marketplace.priceRange")}: ${value.priceMin || "…"}–${value.priceMax || "…"}`}
                  onRemove={() =>
                    onChange({ ...value, priceMin: "", priceMax: "" })
                  }
                  removeLabel={t("common.close")}
                />
              ) : null}
              <button
                type="button"
                onClick={clearAdvanced}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                {t("marketplace.clearFilters")}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {typeof resultCount === "number" ? (
              <p className="text-xs font-medium text-muted">
                {t("marketplace.productsCount", { count: resultCount })}
              </p>
            ) : (
              <span />
            )}
            {hasSearch && !hasAdvanced ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                {t("marketplace.clearFilters")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showFilterButton ? (
        <MarketplaceFilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          value={value}
          categoryOptions={categoryOptions}
          industryOptions={industryOptions}
          onApply={({ categories, industries, priceMin, priceMax }) =>
            onChange({ ...value, categories, industries, priceMin, priceMax })
          }
        />
      ) : null}
    </>
  );
}

function SummaryChip({
  label,
  onRemove,
  removeLabel,
}: {
  label: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-secondary px-2.5 py-1 text-xs font-semibold text-heading">
      {label}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="rounded p-0.5 text-muted hover:bg-bg-hover hover:text-heading"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
