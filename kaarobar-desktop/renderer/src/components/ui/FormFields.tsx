"use client";

import { useState, type ReactNode } from "react";
import { useField, useFormikContext } from "formik";
import { Eye, EyeOff } from "lucide-react";
import Select, { type SelectOption } from "@/components/ui/Select";
import SearchSelect, {
  type SearchSelectOption,
} from "@/components/ui/SearchSelect";
import SearchMultiSelect from "@/components/ui/SearchMultiSelect";
import DateTimePicker, {
  type DateTimePickerMode,
} from "@/components/ui/DateTimePicker";
import Switch from "@/components/ui/Switch";
import { Field, fieldClass, fieldTextareaClass } from "@/components/app/ui";
import { inferFieldStartIcon } from "@/components/ui/fieldIcons";
import { useT } from "@/lib/i18n";

type BaseProps = {
  name: string;
  label?: string;
  className?: string;
};

export function FormikTextField({
  name,
  label,
  type = "text",
  placeholder,
  required,
  className,
  rows,
  autoComplete,
  hint,
  startIcon,
  endIcon,
  showIcon = true,
}: BaseProps & {
  type?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  autoComplete?: string;
  hint?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** When false, skip auto-inferred start icons. */
  showIcon?: boolean;
}) {
  const t = useT();
  const [field, meta] = useField(name);
  const [showPassword, setShowPassword] = useState(false);
  const error = meta.touched && meta.error ? meta.error : undefined;
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const resolvedStart =
    startIcon === null
      ? null
      : startIcon ?? (showIcon ? inferFieldStartIcon(type, name) : null);
  const resolvedEnd = isPassword ? null : endIcon ?? null;
  const resolvedPlaceholder =
    placeholder ??
    (label ? t("common.enterField", { field: label }) : undefined);
  const hasStart = Boolean(resolvedStart);
  const hasEnd = Boolean(resolvedEnd) || isPassword;
  const controlClass = `${type === "textarea" ? fieldTextareaClass : fieldClass}${
    hasStart ? " has-start-icon" : ""
  }${hasEnd ? " has-end-icon" : ""}${error ? " !border-danger" : ""}`;

  return (
    <div className={className}>
      <Field label={label || ""} required={required} hint={hint} error={error}>
        {type === "textarea" ? (
          <div className="relative">
            {resolvedStart ? (
              <span className="glass-field-icon glass-field-icon-start !top-3.5 !translate-y-0">
                {resolvedStart}
              </span>
            ) : null}
            <textarea
              {...field}
              rows={rows ?? 3}
              placeholder={resolvedPlaceholder}
              required={required}
              autoComplete={autoComplete}
              className={controlClass}
            />
          </div>
        ) : (
          <div className="relative">
            {resolvedStart ? (
              <span className="glass-field-icon glass-field-icon-start">
                {resolvedStart}
              </span>
            ) : null}
            <input
              {...field}
              type={inputType}
              placeholder={resolvedPlaceholder}
              required={required}
              autoComplete={autoComplete}
              className={controlClass}
            />
            {isPassword ? (
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-heading"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            ) : resolvedEnd ? (
              <span className="glass-field-icon glass-field-icon-end">
                {resolvedEnd}
              </span>
            ) : null}
          </div>
        )}
      </Field>
    </div>
  );
}

/** Prefer FormikSwitchField for boolean form toggles. */
export function FormikCheckboxField({
  name,
  label,
  className,
}: BaseProps) {
  const [field, meta] = useField({ name, type: "checkbox" });
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <label className={`flex items-center gap-2 text-sm text-heading ${className || ""}`}>
      <input type="checkbox" {...field} checked={Boolean(field.value)} />
      {label}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function FormikSwitchField({
  name,
  label,
  description,
  className,
}: BaseProps & { description?: string }) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div className={className || "sm:col-span-2"}>
      <Switch
        checked={Boolean(field.value)}
        onChange={(next) => helpers.setValue(next)}
        label={label}
        description={description}
        name={name}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function FormikSelectField({
  name,
  label,
  options,
  selectedLabel,
  placeholder,
  className,
}: BaseProps & {
  options: SelectOption[];
  selectedLabel?: string;
  placeholder?: string;
}) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div className={className}>
      <Field label={label || ""} error={error}>
        <Select
          value={field.value ?? ""}
          selectedLabel={selectedLabel}
          onChange={(v) => helpers.setValue(v)}
          options={options}
          placeholder={placeholder}
        />
      </Field>
    </div>
  );
}

export function FormikSearchSelectField({
  name,
  label,
  options,
  selectedLabel,
  placeholder,
  className,
}: BaseProps & {
  options: SearchSelectOption[];
  selectedLabel?: string;
  placeholder?: string;
}) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div className={className}>
      <Field label={label || ""} error={error}>
        <SearchSelect
          value={field.value || null}
          selectedLabel={selectedLabel}
          onChange={(v) => helpers.setValue(v)}
          options={options}
          label={undefined}
          placeholder={placeholder}
        />
      </Field>
    </div>
  );
}

export function FormikSearchMultiSelectField({
  name,
  label,
  options,
  selectedOptions,
  placeholder,
  className,
}: BaseProps & {
  options: SearchSelectOption[];
  selectedOptions?: SearchSelectOption[];
  placeholder?: string;
}) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div className={className}>
      <Field label={label || ""} error={error}>
        <SearchMultiSelect
          value={Array.isArray(field.value) ? field.value : []}
          selectedOptions={selectedOptions}
          onChange={(v) => helpers.setValue(v)}
          options={options}
          placeholder={placeholder}
        />
      </Field>
    </div>
  );
}

export function FormikDateTimeField({
  name,
  label,
  mode = "date",
  placeholder,
  className,
  required,
}: BaseProps & {
  mode?: DateTimePickerMode;
  placeholder?: string;
  required?: boolean;
}) {
  const [field, meta, helpers] = useField(name);
  const { setFieldTouched } = useFormikContext();
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <DateTimePicker
      name={name}
      label={label}
      mode={mode}
      value={field.value ?? ""}
      onChange={(v) => {
        void helpers.setValue(v);
        void setFieldTouched(name, true, false);
      }}
      placeholder={placeholder}
      required={required}
      className={className}
      error={error}
    />
  );
}
