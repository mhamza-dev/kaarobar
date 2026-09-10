"use client";

import { useField } from "formik";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type FormSelectFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  options: Option[];
  disabled?: boolean;
  className?: string;
};

/** The Formik ⇄ shadcn bridge for a single-value select — see FormTextField for the pattern. */
export function FormSelectField({
  name,
  label,
  hint,
  placeholder = "Select…",
  options,
  disabled,
  className,
}: FormSelectFieldProps) {
  const [field, meta, helpers] = useField(name);
  const id = useId();
  const errorId = `${id}-error`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select
        value={field.value || ""}
        onValueChange={(value: string) => helpers.setValue(value)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          onBlur={() => helpers.setTouched(true)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
