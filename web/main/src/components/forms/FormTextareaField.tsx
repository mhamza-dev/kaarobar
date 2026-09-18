"use client";

import { useField } from "formik";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FormTextareaFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
};

/** Multi-line sibling of `FormTextField` — same `useField()` bridge. */
export function FormTextareaField({
  name,
  label,
  hint,
  placeholder,
  rows = 4,
  disabled,
  className,
}: FormTextareaFieldProps) {
  const [field, meta] = useField(name);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Textarea
        {...field}
        value={field.value ?? ""}
        id={id}
        rows={rows}
        placeholder={placeholder}
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
