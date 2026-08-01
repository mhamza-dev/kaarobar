
import { useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import FilterDrawer from "@/components/app/FilterDrawer";
import { useT } from "@/lib/i18n";
import {
  countAdvancedFilters,
  emptyStaffListFilters,
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
  const showFilterButton =
    !hideFilters &&
    (Boolean(config.showDateRange) ||
      (config.statusOptions?.length ?? 0) > 0 ||
      (config.categoryOptions?.length ?? 0) > 0);

  return (
    <>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-md border border-border bg-bg-secondary/60 px-3 py-2.5 sm:px-4 ${className}`}
      >
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <span className="sr-only">{t("common.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder={searchPlaceholder ?? t("common.search")}
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-9 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand-soft"
          />
          {value.search ? (
            <button
              type="button"
              aria-label={t("listFilters.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover hover:text-heading"
              onClick={() => onChange({ ...value, search: "" })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {showFilterButton ? (
            <Button
              type="button"
              variant={advancedCount > 0 ? "primary" : "outline"}
              size="sm"
              startIcon={<Filter className="h-3.5 w-3.5" />}
              onClick={() => setDrawerOpen(true)}
            >
              {t("listFilters.filters")}
              {advancedCount > 0 ? (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-foreground/20 px-1.5 text-[11px] font-bold tabular-nums">
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
