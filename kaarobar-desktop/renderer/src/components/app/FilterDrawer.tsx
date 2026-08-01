
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import MultiSelect from "@/components/ui/MultiSelect";
import DateRangeFields from "@/components/app/DateRangeFields";
import { useT } from "@/lib/i18n";
import {
  emptyStaffListFilters,
  normalizeFilterOptions,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";

export type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  value: StaffListFilterState;
  onApply: (next: StaffListFilterState) => void;
  config?: ListFilterConfig;
  title?: string;
  description?: string;
  footerExtra?: ReactNode;
};

export default function FilterDrawer({
  open,
  onClose,
  value,
  onApply,
  config = {},
  title,
  description,
  footerExtra,
}: FilterDrawerProps) {
  const t = useT();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<StaffListFilterState>(value);

  const showDateRange = Boolean(config.showDateRange);
  const categoryOptions = normalizeFilterOptions(config.categoryOptions);
  const statusOptions = config.statusOptions ?? [];
  const showCategories = categoryOptions.length > 0;
  const showStatus = statusOptions.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

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
    setDraft((d) => ({
      ...emptyStaffListFilters(),
      search: d.search,
    }));
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
              {title ?? t("listFilters.title")}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-body">{description}</p>
            ) : (
              <p className="mt-1 text-sm text-body">{t("listFilters.description")}</p>
            )}
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
          {showDateRange ? (
            <DateRangeFields
              from={draft.from}
              to={draft.to}
              onFromChange={(from) => setDraft((d) => ({ ...d, from }))}
              onToChange={(to) => setDraft((d) => ({ ...d, to }))}
            />
          ) : null}

          {showStatus ? (
            <MultiSelect
              label={config.statusLabel ?? t("common.status")}
              options={statusOptions}
              value={draft.statuses}
              onChange={(statuses) => setDraft((d) => ({ ...d, statuses }))}
            />
          ) : null}

          {showCategories ? (
            <MultiSelect
              label={config.categoryLabel ?? t("listFilters.categories")}
              options={categoryOptions}
              value={draft.categories}
              onChange={(categories) => setDraft((d) => ({ ...d, categories }))}
            />
          ) : null}

          {!showDateRange && !showStatus && !showCategories ? (
            <p className="text-sm text-muted">{t("listFilters.noFields")}</p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
              {t("listFilters.clear")}
            </Button>
            {footerExtra}
          </div>
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
