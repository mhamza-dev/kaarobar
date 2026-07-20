"use client";

import React, { useState } from "react";
import { useField } from "formik";
import { Eye, EyeOff } from "lucide-react";

interface InputProps {
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "switch"
    | "file"
    | "tel"
    | "url"
    | "number"
    | "email"
    | "password";

  name: string;

  id?: string;

  label?: string | React.ReactNode;

  placeholder?: string;

  required?: boolean;

  disabled?: boolean;

  rows?: number;

  leftIcon?: React.ReactNode;

  rightIcon?: React.ReactNode;

  options?: {
    label: string;
    value: string;
  }[];
}

const Input = ({
  type,
  label,
  options = [],
  rows = 5,
  leftIcon,
  rightIcon,
  ...props
}: InputProps): React.ReactElement => {
  const [field, meta, helpers] = useField(props.name);

  const [showPassword, setShowPassword] = useState(false);

  const inputId = props.id ?? props.name;

  const hasError = meta.touched && Boolean(meta.error);

  const inputType =
    type === "password" ? (showPassword ? "text" : "password") : type;

  const baseClass = `
    w-full
    rounded-md
    border
    bg-bg-secondary

    py-2.5

    ${leftIcon ? "pl-10" : "pl-3"}

    ${rightIcon || type === "password" ? "pr-10" : "pr-3"}

    text-sm
    text-heading
    placeholder:text-muted

    shadow-sm
    outline-none

    transition-all

    ${
      hasError
        ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger-soft"
        : "border-border focus:border-brand focus:ring-2 focus:ring-brand-soft"
    }

    disabled:bg-bg-tertiary
    disabled:text-muted
    disabled:cursor-not-allowed
  `;

  return (
    <div className="mb-5">
      {/* Label */}

      {label && !["checkbox", "switch"].includes(type) && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-heading"
        >
          {label}

          {props.required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      {/* Textarea */}

      {type === "textarea" && (
        <textarea
          id={inputId}
          rows={rows}
          placeholder={props.placeholder}
          disabled={props.disabled}
          className={`${baseClass} resize-y`}
          {...field}
        />
      )}

      {/* Select */}

      {type === "select" && (
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {leftIcon}
            </div>
          )}

          <select
            id={inputId}
            disabled={props.disabled}
            className={`${baseClass} appearance-none`}
            {...field}
          >
            <option value="">Select...</option>

            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Normal Inputs */}

      {["text", "email", "password", "number", "tel", "url", "file"].includes(
        type,
      ) && (
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            type={inputType}
            placeholder={props.placeholder}
            disabled={props.disabled}
            className={baseClass}
            {...field}
            onChange={
              type === "file"
                ? (e) => helpers.setValue(e.currentTarget.files?.[0] ?? null)
                : field.onChange
            }
          />

          {/* Password Eye */}

          {type === "password" && (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-muted
                hover:text-heading
                transition-colors
              "
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}

          {/* Custom Right Icon */}

          {type !== "password" && rightIcon && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
              {rightIcon}
            </div>
          )}
        </div>
      )}

      {/* Checkbox */}

      {type === "checkbox" && (
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(field.value)}
            disabled={props.disabled}
            onChange={(e) => helpers.setValue(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
          />

          <span className="text-sm text-body">
            {label}

            {props.required && <span className="ml-1 text-danger">*</span>}
          </span>
        </label>
      )}

      {/* Switch */}

      {type === "switch" && (
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="sr-only"
            checked={Boolean(field.value)}
            disabled={props.disabled}
            onChange={(e) => helpers.setValue(e.target.checked)}
          />

          <div
            className={`relative h-6 w-11 rounded-full transition-colors ${
              field.value ? "bg-brand" : "bg-border"
            }`}
          >
            <div
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                field.value ? "translate-x-5" : ""
              }`}
            />
          </div>

          <span className="text-sm text-body">{label}</span>
        </label>
      )}

      {/* Error */}

      {hasError && <p className="mt-1 text-sm text-danger">{meta.error}</p>}
    </div>
  );
};

export default Input;
