"use client";

import { useField } from "formik";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormTextFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  type?: "text" | "email" | "password" | "tel" | "url" | "search";
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * The Formik ⇄ shadcn bridge every text-like field goes through — same
 * `useField()` + prop-spread pattern as desktop/local's
 * `components/form/FormTextField.tsx`, wrapping the shadcn `Input` instead
 * of a hand-rolled one. `meta.touched && meta.error` is the one place a
 * field's validation error surfaces; nothing else in the app should
 * duplicate that check.
 */
export function FormTextField({
  name,
  label,
  hint,
  type = "text",
  placeholder,
  autoComplete,
  autoFocus,
  disabled,
  className,
}: FormTextFieldProps) {
  const [field, meta] = useField(name);
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showError = meta.touched && !!meta.error;
  const isPassword = type === "password";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          {...field}
          id={id}
          type={isPassword && revealed ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className={isPassword ? "pr-9" : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={revealed ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
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
