"use client";

import { useField } from "formik";
import { useId } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type FormSwitchProps = {
  name: string;
  label: string;
  /** Shown under the label — use it for the "what does turning this on do" sentence. */
  hint?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Boolean bridge rendered as a settings-row toggle (label left, switch
 * right) — the same value contract as `FormCheckbox`, a different affordance.
 * Reach for this in settings forms where the change reads as "on/off", and
 * for `FormCheckbox` inside a list of choices.
 */
export function FormSwitch({ name, label, hint, disabled, className }: FormSwitchProps) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const id = useId();
  const errorId = `${id}-error`;
  const showError = meta.touched && !!meta.error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor={id} className="font-normal">
            {label}
          </Label>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Switch
          id={id}
          checked={!!field.value}
          onCheckedChange={(checked: boolean) => helpers.setValue(checked)}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
        />
      </div>
      {showError && (
        <p id={errorId} className="text-xs text-destructive">
          {meta.error}
        </p>
      )}
    </div>
  );
}
