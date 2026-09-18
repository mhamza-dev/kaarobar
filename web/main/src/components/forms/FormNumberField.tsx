"use client";

import { useField } from "formik";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormNumberFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered inside the field, e.g. a currency code or a unit. */
  suffix?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Numeric sibling of `FormTextField`.
 *
 * Holds the raw string in Formik state rather than coercing to `number` on
 * every keystroke: coercing eagerly makes a half-typed "1." or "-" collapse
 * to `NaN` under the cursor. An empty input becomes `""`, never `0` — Yup
 * can then tell "left blank" apart from "deliberately zero", which matters
 * for optional prices and quantities.
 */
export function FormNumberField({
  name,
  label,
  hint,
  placeholder,
  min,
  max,
  step,
  suffix,
  disabled,
  className,
}: FormNumberFieldProps) {
  const [field, meta] = useField(name);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          {...field}
          value={field.value ?? ""}
          id={id}
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className={suffix ? "pr-12" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {showError ? (
        <p id={errorId} className="text-xs text-destructive">
          {meta.error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
