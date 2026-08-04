"use client";

import { useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import FilterDrawer from "@/components/app/FilterDrawer";
import { useT } from "@/lib/i18n";
import {
  countAdvancedFilters,
  emptyStaffListFilters,
  normalizeFilterOptions,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";

export type ListToolbarProps = {
  value: StaffListFilterState;
  onChange: (next: StaffListFilterState) => void;
  config?: ListFilterConfig;
  searchPlaceholder?: string;
  className?: string;
  actions?: ReactNode;
  /** Hide the Filters button (search-only toolbar). */
  hideFilters?: boolean;
};

function hasAdvancedConfig(config: ListFilterConfig): boolean {
  return (
    Boolean(config.showDateRange) ||
    Boolean(config.showAmountRange) ||
    Boolean(config.showBalanceRange) ||
    Boolean(config.showCreditLimitRange) ||
    (config.statusOptions?.length ?? 0) > 0 ||
    (config.categoryOptions?.length ?? 0) > 0 ||
    (config.paymentMethodOptions?.length ?? 0) > 0
  );
}

export default function ListToolbar({
  value,
  onChange,
  config = {},
  searchPlaceholder,
  className = "",
  actions,
  hideFilters = false,
}: ListToolbarProps) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const advancedCount = countAdvancedFilters(value, config);
  const showFilterButton = !hideFilters && hasAdvancedConfig(config);

  const categoryOptions = normalizeFilterOptions(config.categoryOptions);
  const statusLabel = (v: string) =>
    config.statusOptions?.find((o) => o.value === v)?.label ?? v;
  const categoryLabel = (v: string) =>
    categoryOptions.find((o) => o.value === v)?.label ?? v;
  const paymentLabel = (v: string) =>
    config.paymentMethodOptions?.find((o) => o.value === v)?.label ?? v;

  const summaryChips: { key: string; label: string; clear: () => void }[] = [];
  if (config.showDateRange) {
    if (value.from.trim()) {
      summaryChips.push({
        key: "from",
        label: `${t("listFilters.min")}: ${value.from}`,
        clear: () => onChange({ ...value, from: "" }),
      });
    }
    if (value.to.trim()) {
      summaryChips.push({
        key: "to",
        label: `${t("listFilters.max")}: ${value.to}`,
        clear: () => onChange({ ...value, to: "" }),
      });
    }
  }
  for (const s of value.statuses) {
    summaryChips.push({
      key: `st:${s}`,
      label: statusLabel(s),
      clear: () =>
        onChange({
          ...value,
          statuses: value.statuses.filter((x) => x !== s),
        }),
    });
  }
  for (const c of value.categories) {
    summaryChips.push({
      key: `cat:${c}`,
      label: categoryLabel(c),
      clear: () =>
        onChange({
          ...value,
          categories: value.categories.filter((x) => x !== c),
        }),
    });
  }
  for (const m of value.paymentMethods) {
    summaryChips.push({
      key: `pay:${m}`,
      label: paymentLabel(m),
      clear: () =>
        onChange({
          ...value,
          paymentMethods: value.paymentMethods.filter((x) => x !== m),
        }),
    });
  }
  if (config.showAmountRange && (value.amountMin || value.amountMax)) {
    summaryChips.push({
      key: "amount",
      label: `${t("listFilters.amountRange")}: ${value.amountMin || "…"}–${value.amountMax || "…"}`,
      clear: () => onChange({ ...value, amountMin: "", amountMax: "" }),
    });
  }
  if (config.showBalanceRange && (value.balanceMin || value.balanceMax)) {
    summaryChips.push({
      key: "balance",
      label: `${t("listFilters.balanceRange")}: ${value.balanceMin || "…"}–${value.balanceMax || "…"}`,
      clear: () => onChange({ ...value, balanceMin: "", balanceMax: "" }),
    });
  }
  if (
    config.showCreditLimitRange &&
    (value.creditLimitMin || value.creditLimitMax)
  ) {
    summaryChips.push({
      key: "credit",
      label: `${t("listFilters.creditLimitRange")}: ${value.creditLimitMin || "…"}–${value.creditLimitMax || "…"}`,
      clear: () =>
        onChange({ ...value, creditLimitMin: "", creditLimitMax: "" }),
    });
  }

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="relative min-w-[12rem] flex-1">
            <span className="sr-only">{t("common.search")}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={value.search}
              onChange={(e) => onChange({ ...value, search: e.target.value })}
              placeholder={searchPlaceholder ?? t("common.search")}
              className="w-full rounded-md border border-border bg-card py-2.5 pe-9 ps-9 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand/20"
            />
            {value.search ? (
              <button
                type="button"
                aria-label={t("listFilters.clearSearch")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover hover:text-heading"
                onClick={() => onChange({ ...value, search: "" })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                    : t("listFilters.filters")
                }
              >
                {t("listFilters.filters")}
                {advancedCount > 0 ? (
                  <span className="ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-foreground/20 px-1.5 text-[11px] font-bold tabular-nums">
                    {advancedCount}
                  </span>
                ) : null}
              </Button>
            ) : null}

            {advancedCount > 0 || value.search.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(emptyStaffListFilters())}
              >
                {t("listFilters.clearAll")}
              </Button>
            ) : null}

            {actions}
          </div>
        </div>

        {summaryChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {summaryChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-secondary px-2.5 py-1 text-xs font-semibold text-heading"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={t("common.close")}
                  onClick={chip.clear}
                  className="rounded p-0.5 text-muted hover:bg-bg-hover hover:text-heading"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {showFilterButton ? (
        <FilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          value={value}
          onApply={onChange}
          config={config}
        />
      ) : null}
    </>
  );
}
