"use client";

import { useField } from "formik";
import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormCheckboxProps = {
  name: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Boolean bridge over the shadcn `Checkbox`.
 *
 * Uses `helpers.setValue` rather than spreading `field`: Base UI reports
 * state through `onCheckedChange(boolean)`, not a DOM change event, so
 * Formik's `field.onChange` has no `event.target` to read.
 */
export function FormCheckbox({ name, label, hint, disabled, className }: FormCheckboxProps) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const id = useId();
  const errorId = `${id}-error`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={!!field.value}
          onCheckedChange={(checked: boolean) => helpers.setValue(checked)}
          onBlur={() => helpers.setTouched(true)}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
        />
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
      </div>
      {showError ? (
        <p id={errorId} className="text-xs text-destructive">
          {meta.error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
