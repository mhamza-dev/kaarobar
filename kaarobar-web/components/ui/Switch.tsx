"use client";

import { useId } from "react";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  name?: string;
};

/**
 * Accessible brand switch for boolean form fields.
 */
export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = "",
  name,
}: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        disabled={disabled}
        name={name}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? "bg-brand" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "start-0.5 translate-x-5 rtl:-translate-x-5" : "start-0.5"
          }`}
        />
      </button>
      {(label || description) && (
        <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
          {label ? (
            <span className="block text-sm font-medium text-heading">{label}</span>
          ) : null}
          {description ? (
            <span className="mt-0.5 block text-xs text-muted">{description}</span>
          ) : null}
        </label>
      )}
    </div>
  );
}
