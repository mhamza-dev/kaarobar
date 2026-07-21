import React from "react";
import { Check } from "lucide-react";

export interface OptionSelectorItem<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface OptionSelectorProps<T extends string = string> {
  value: T;
  options: OptionSelectorItem<T>[];
  onChange: (value: T) => void;
  label?: string;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const OptionSelector = <T extends string>({
  value,
  options,
  onChange,
  label,
  columns = 2,
  className = "",
}: OptionSelectorProps<T>): React.ReactElement => {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <div className={`mb-5 ${className}`}>
      {label && (
        <p className="mb-2.5 text-sm font-medium text-heading">{label}</p>
      )}

      <div
        role="radiogroup"
        aria-label={label ?? "Options"}
        className={`grid gap-3 ${gridCols[columns]}`}
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={`
                group relative overflow-hidden rounded-md border p-4 text-left
                transition-all duration-200 ease-out
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-brand focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50

                ${
                  selected
                    ? `
                      border-brand bg-brand-soft/80 shadow-sm
                      ring-1 ring-brand/25
                    `
                    : `
                      border-border bg-bg-primary
                      hover:-translate-y-0.5 hover:border-brand/35
                      hover:bg-card hover:shadow-sm
                    `
                }
              `}
            >
              {selected && (
                <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient" />
              )}

              <div className="flex items-start gap-3.5 pr-7">
                {option.icon && (
                  <div
                    className={`
                      flex h-11 w-11 shrink-0 items-center justify-center
                      rounded-md transition-all duration-200

                      ${
                        selected
                          ? "bg-brand text-white shadow-brand"
                          : `
                            border border-border bg-card text-body
                            group-hover:border-brand/30 group-hover:text-brand
                          `
                      }
                    `}
                  >
                    {option.icon}
                  </div>
                )}

                <div className="min-w-0 pt-0.5">
                  <p
                    className={`text-sm font-semibold tracking-tight ${
                      selected ? "text-brand" : "text-heading"
                    }`}
                  >
                    {option.label}
                  </p>

                  {option.description && (
                    <p className="mt-1 text-xs leading-5 text-body">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`
                  absolute right-3 top-3 flex h-6 w-6 items-center justify-center
                  rounded-md border transition-all duration-200

                  ${
                    selected
                      ? "border-brand bg-brand text-white shadow-sm"
                      : "border-border bg-card text-transparent group-hover:border-brand/40"
                  }
                `}
              >
                <Check size={14} strokeWidth={2.5} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OptionSelector;
