"use client";

import { useField, useFormikContext } from "formik";
import Select, { type SelectOption } from "@/components/ui/Select";
import SearchSelect, {
  type SearchSelectOption,
} from "@/components/ui/SearchSelect";
import SearchMultiSelect from "@/components/ui/SearchMultiSelect";
import DateTimePicker, {
  type DateTimePickerMode,
} from "@/components/ui/DateTimePicker";
import { Field, fieldClass } from "@/components/app/ui";

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
}: BaseProps & {
  type?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  autoComplete?: string;
}) {
  const [field, meta] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div className={className}>
      <Field label={label || ""}>
        {type === "textarea" ? (
          <textarea
            {...field}
            rows={rows ?? 3}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            className={fieldClass}
          />
        ) : (
          <input
            {...field}
            type={type}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            className={fieldClass}
          />
        )}
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

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
      <Field label={label || ""}>
      <Select
        value={field.value ?? ""}
        selectedLabel={selectedLabel}
        onChange={(v) => helpers.setValue(v)}
        options={options}
        placeholder={placeholder}
      />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
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
      <Field label={label || ""}>
      <SearchSelect
        value={field.value || null}
        selectedLabel={selectedLabel}
        onChange={(v) => helpers.setValue(v)}
        options={options}
        label={undefined}
        placeholder={placeholder}
      />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
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
      <Field label={label || ""}>
      <SearchMultiSelect
        value={Array.isArray(field.value) ? field.value : []}
        selectedOptions={selectedOptions}
        onChange={(v) => helpers.setValue(v)}
        options={options}
        placeholder={placeholder}
      />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
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
