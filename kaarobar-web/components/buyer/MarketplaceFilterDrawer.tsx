"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import MultiSelect from "@/components/ui/MultiSelect";
import NumberRangeFields from "@/components/app/NumberRangeFields";
import { useT } from "@/lib/i18n";
import { normalizeFilterOptions } from "@/lib/listFilters";
import type { MarketplaceFeedFilters } from "@/lib/marketplaceFeed";

export type MarketplaceFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  value: MarketplaceFeedFilters;
  onApply: (
    next: Pick<
      MarketplaceFeedFilters,
      "categories" | "industries" | "priceMin" | "priceMax"
    >
  ) => void;
  categoryOptions: string[];
  industryOptions: string[];
};

type AdvancedDraft = {
  categories: string[];
  industries: string[];
  priceMin: string;
  priceMax: string;
};

/** Buyer marketplace filter drawer — draft categories/industries/price until Apply. */
export default function MarketplaceFilterDrawer({
  open,
  onClose,
  value,
  onApply,
  categoryOptions,
  industryOptions,
}: MarketplaceFilterDrawerProps) {
  const t = useT();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<AdvancedDraft>({
    categories: value.categories,
    industries: value.industries,
    priceMin: value.priceMin,
    priceMax: value.priceMax,
  });

  const industryOpts = normalizeFilterOptions(industryOptions);
  const categoryOpts = normalizeFilterOptions(categoryOptions);
  const showIndustries = industryOpts.length > 0;
  const showCategories = categoryOpts.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setDraft({
        categories: value.categories,
        industries: value.industries,
        priceMin: value.priceMin,
        priceMax: value.priceMax,
      });
    }
  }, [open, value.categories, value.industries, value.priceMin, value.priceMax]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  function clearAdvanced() {
    setDraft({ categories: [], industries: [], priceMin: "", priceMax: "" });
  }

  function apply() {
    onApply(draft);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl animate-sheet"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-heading">
              {t("marketplace.filtersTitle")}
            </h2>
            <p className="mt-1 text-sm text-body">{t("marketplace.filtersDesc")}</p>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            className="rounded-md p-1.5 text-muted hover:bg-bg-hover hover:text-heading"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <NumberRangeFields
            label={t("marketplace.priceRange")}
            min={draft.priceMin}
            max={draft.priceMax}
            onMinChange={(priceMin) => setDraft((d) => ({ ...d, priceMin }))}
            onMaxChange={(priceMax) => setDraft((d) => ({ ...d, priceMax }))}
            minPlaceholder={t("listFilters.min")}
            maxPlaceholder={t("listFilters.max")}
          />

          {showIndustries ? (
            <MultiSelect
              label={t("marketplace.filterIndustry")}
              options={industryOpts}
              value={draft.industries}
              onChange={(industries) => setDraft((d) => ({ ...d, industries }))}
            />
          ) : null}

          {showCategories ? (
            <MultiSelect
              label={t("marketplace.filterCategory")}
              options={categoryOpts}
              value={draft.categories}
              onChange={(categories) => setDraft((d) => ({ ...d, categories }))}
            />
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
            {t("listFilters.clear")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={apply}>
              {t("listFilters.apply")}
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
