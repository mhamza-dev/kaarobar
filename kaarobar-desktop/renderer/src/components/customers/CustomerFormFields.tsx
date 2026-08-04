import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import {
  CUSTOMER_FORM_FIELDS,
  type Customer,
  type CustomerForm,
} from "@/lib/customers";

type TFn = (key: string) => string;

export default function CustomerFormFields({
  form,
  editing,
  onChange,
  t,
}: {
  form: CustomerForm;
  editing: Customer | null;
  onChange: (next: CustomerForm) => void;
  t: TFn;
}) {
  return (
    <>
      {CUSTOMER_FORM_FIELDS.map((f) =>
        f.type === "checkbox" ? (
          <label key={f.key} className="flex items-center gap-2 text-sm text-heading sm:col-span-2">
            <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => onChange({ ...form, [f.key]: e.target.checked })} />
            {t(f.labelKey)}
          </label>
        ) : f.type === "textarea" ? (
          <Field key={f.key} label={t(f.labelKey)}>
            <textarea className={fieldClass} rows={3} value={String(form[f.key] ?? "")} onChange={(e) => onChange({ ...form, [f.key]: e.target.value })} />
          </Field>
        ) : (
          <Field key={f.key} label={t(f.labelKey)}>
            <input
              className={fieldClass}
              type={f.key === "credit_limit" ? "number" : f.type || "text"}
              step={f.key === "credit_limit" ? "0.01" : undefined}
              min={f.key === "credit_limit" ? 0 : undefined}
              required={f.required || (f.key === "portal_password" && form.portal_enabled && !editing?.portal_enabled)}
              minLength={f.type === "password" ? 8 : undefined}
              autoComplete={f.type === "password" ? "new-password" : undefined}
              placeholder={f.key === "portal_password" && editing?.portal_enabled ? t("customers.portalPasswordHint") : undefined}
              value={String(form[f.key] ?? "")}
              onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
              onBlur={f.key === "credit_limit" ? (e) => {
                const v = e.target.value.trim();
                if (!v) return;
                onChange({ ...form, credit_limit: formatDecimal(v) });
              } : undefined}
            />
            {f.hintKey ? <p className="mt-1 text-xs text-muted">{t(f.hintKey)}</p> : null}
          </Field>
        )
      )}
    </>
  );
}
