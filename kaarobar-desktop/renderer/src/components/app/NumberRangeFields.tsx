"use client";

import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";

type Props = {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  label?: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
};

export default function NumberRangeFields({
  min,
  max,
  onMinChange,
  onMaxChange,
  label,
  minPlaceholder,
  maxPlaceholder,
}: Props) {
  const t = useT();
  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          onBlur={() => {
            if (!min.trim()) return;
            onMinChange(formatDecimal(min));
          }}
          placeholder={minPlaceholder || t("listFilters.min")}
          className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-heading outline-none focus:border-brand/40"
          aria-label={minPlaceholder || t("listFilters.min")}
        />
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          onBlur={() => {
            if (!max.trim()) return;
            onMaxChange(formatDecimal(max));
          }}
          placeholder={maxPlaceholder || t("listFilters.max")}
          className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-heading outline-none focus:border-brand/40"
          aria-label={maxPlaceholder || t("listFilters.max")}
        />
      </div>
    </div>
  );
}
