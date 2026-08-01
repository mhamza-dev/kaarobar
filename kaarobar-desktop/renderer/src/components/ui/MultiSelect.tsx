
import { Check } from "lucide-react";
import type { ListFilterOption } from "@/lib/listFilters";

export type MultiSelectProps = {
  label?: string;
  options: ListFilterOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  emptyHint?: string;
};

export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  className = "",
  emptyHint,
}: MultiSelectProps) {
  function toggle(optionValue: string) {
    const has = value.includes(optionValue);
    onChange(
      has ? value.filter((v) => v !== optionValue) : [...value, optionValue]
    );
  }

  return (
    <div className={className}>
      {label ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
      ) : null}
      {options.length === 0 ? (
        emptyHint ? (
          <p className="text-sm text-muted">{emptyHint}</p>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
          {options.map((opt) => {
            const on = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-card text-heading hover:border-brand/40"
                }`}
              >
                {on ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
