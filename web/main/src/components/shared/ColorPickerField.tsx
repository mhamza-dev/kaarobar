"use client";

import { useField } from "formik";
import { Check } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND_COLOR_PRESETS, DEFAULT_BRAND_COLOR, deriveBrandPalette } from "@/lib/theme";
import { cn } from "@/lib/utils";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

type ColorPickerFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Brand-colour picker for a business's flat `brand_color` string.
 *
 * Three ways in — a preset swatch, the native colour well, and a typed hex
 * — all writing the same `#rrggbb` string, since that is exactly what the
 * backend stores (a plain column, not a nested branding object). The
 * preview strip runs the value through `deriveBrandPalette()`, the same
 * function `useBrandTheme()` applies at runtime, so what the form shows is
 * what the shell will actually look like rather than an approximation.
 */
export function ColorPickerField({
  name,
  label,
  hint,
  disabled,
  className,
}: ColorPickerFieldProps) {
  const [field, meta, helpers] = useField(name);
  const id = useId();
  const errorId = `${id}-error`;
  const showError = meta.touched && !!meta.error;

  const value: string = field.value || "";
  const isValid = HEX_PATTERN.test(value);
  const palette = deriveBrandPalette(isValid ? value : DEFAULT_BRAND_COLOR);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValid ? value : DEFAULT_BRAND_COLOR}
          onChange={(event) => helpers.setValue(event.target.value)}
          onBlur={() => helpers.setTouched(true)}
          disabled={disabled}
          aria-label="Pick a brand colour"
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1 disabled:opacity-50"
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => helpers.setValue(event.target.value)}
          onBlur={() => helpers.setTouched(true)}
          placeholder={DEFAULT_BRAND_COLOR}
          spellCheck={false}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className="font-mono"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BRAND_COLOR_PRESETS.map((preset) => {
          const active = value.toLowerCase() === preset.hex.toLowerCase();
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => {
                helpers.setValue(preset.hex);
                helpers.setTouched(true);
              }}
              style={{ backgroundColor: preset.hex }}
              className="flex size-6 items-center justify-center rounded-full border border-black/10 transition-transform hover:scale-110 disabled:opacity-50"
            >
              {active && <Check className="size-3.5 text-white" />}
            </button>
          );
        })}
      </div>

      <div
        className="flex items-center gap-2 rounded-lg border border-border p-2"
        style={{ backgroundColor: palette.tint }}
      >
        <span
          className="rounded-md px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: palette.primary, color: palette.onPrimary }}
        >
          Preview
        </span>
        <span className="text-xs text-muted-foreground">
          This is how buttons and highlights will look.
        </span>
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
