"use client";

import React, { useState } from "react";
import { useField } from "formik";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { fieldClass, fieldTextareaClass } from "@/components/app/ui";
import { inferFieldStartIcon } from "@/components/ui/fieldIcons";

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
  options?: { label: string; value: string }[];
  className?: string;
}

const Input = ({
  type,
  label,
  options = [],
  rows = 5,
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: InputProps): React.ReactElement => {
  const [field, meta, helpers] = useField(props.name);
  const [showPassword, setShowPassword] = useState(false);
  const inputId = props.id ?? props.name;
  const hasError = meta.touched && Boolean(meta.error);
  const inputType =
    type === "password" ? (showPassword ? "text" : "password") : type;
  const resolvedLeft =
    leftIcon === null
      ? null
      : leftIcon ??
        (["checkbox", "switch", "file"].includes(type)
          ? null
          : inferFieldStartIcon(type, props.name));
  const hasLeft = Boolean(resolvedLeft);
  const hasRight = Boolean(rightIcon) || type === "password" || type === "select";
  const controlClass = `${type === "textarea" ? fieldTextareaClass : fieldClass}${
    hasLeft ? " has-start-icon" : ""
  }${hasRight ? " has-end-icon" : ""}${hasError ? " !border-danger" : ""}`;

  return (
    <div className={className}>
      {label && !["checkbox", "switch"].includes(type) && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-semibold text-heading"
        >
          {label}
          {props.required && <span className="ms-1 text-danger">*</span>}
        </label>
      )}

      {type === "textarea" && (
        <div className="relative">
          {resolvedLeft ? (
            <span className="glass-field-icon glass-field-icon-start !top-3.5 !translate-y-0">
              {resolvedLeft}
            </span>
          ) : null}
          <textarea
            id={inputId}
            rows={rows}
            placeholder={props.placeholder}
            disabled={props.disabled}
            className={controlClass}
            {...field}
          />
        </div>
      )}

      {type === "select" && (
        <div className="relative">
          {resolvedLeft ? (
            <span className="glass-field-icon glass-field-icon-start">
              {resolvedLeft}
            </span>
          ) : null}
          <select
            id={inputId}
            disabled={props.disabled}
            className={`${controlClass} appearance-none`}
            {...field}
          >
            <option value="">Select...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="glass-field-icon glass-field-icon-end">
            <ChevronDown className="h-4 w-4" aria-hidden />
          </span>
        </div>
      )}

      {["text", "email", "password", "number", "tel", "url", "file"].includes(type) && (
        <div className="relative">
          {resolvedLeft ? (
            <span className="glass-field-icon glass-field-icon-start">
              {resolvedLeft}
            </span>
          ) : null}
          <input
            id={inputId}
            type={inputType}
            placeholder={props.placeholder}
            disabled={props.disabled}
            className={controlClass}
            {...field}
            value={type === "file" ? undefined : field.value ?? ""}
            onChange={
              type === "file"
                ? (e) => helpers.setValue(e.currentTarget.files?.[0] ?? null)
                : field.onChange
            }
          />
          {type === "password" && (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-heading"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {type !== "password" && rightIcon && (
            <span className="glass-field-icon glass-field-icon-end">{rightIcon}</span>
          )}
        </div>
      )}

      {type === "checkbox" && (
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(field.value)}
            disabled={props.disabled}
            onChange={(e) => helpers.setValue(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand"
          />
          <span className="text-sm text-body">
            {label}
            {props.required && <span className="ms-1 text-danger">*</span>}
          </span>
        </label>
      )}

      {type === "switch" && (
        <Switch
          id={inputId}
          checked={Boolean(field.value)}
          disabled={props.disabled}
          label={typeof label === "string" ? label : undefined}
          onChange={(next) => helpers.setValue(next)}
        />
      )}

      {hasError && <p className="mt-1 text-xs text-danger">{meta.error}</p>}
    </div>
  );
};

export default Input;
