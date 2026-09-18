"use client";

import { useField } from "formik";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormDatePickerProps = {
  name: string;
  label?: string;
  hint?: string;
  /** `date` keeps `YYYY-MM-DD`; `datetime-local` keeps `YYYY-MM-DDTHH:mm`. */
  mode?: "date" | "datetime";
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Date bridge over the native picker.
 *
 * Deliberately native rather than a rendered calendar: the value stays an
 * ISO-ish string end to end (`YYYY-MM-DD`), which is exactly what the
 * backend's date params expect, and the browser handles locale display,
 * keyboard entry and mobile input for free. Swap in a `react-day-picker`
 * calendar only if a screen needs range selection or disabled-day rules.
 */
export function FormDatePicker({
  name,
  label,
  hint,
  mode = "date",
  min,
  max,
  disabled,
  className,
}: FormDatePickerProps) {
  const [field, meta] = useField(name);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        {...field}
        value={field.value ?? ""}
        id={id}
        type={mode === "datetime" ? "datetime-local" : "date"}
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
      />
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
