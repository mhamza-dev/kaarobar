"use client";

import { useField, useFormikContext } from "formik";
import {
  FormikDateTimeField,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { Field, fieldClass, formGridClass, formStackClass } from "@/components/app/ui";
import type { TemplateFormValues } from "@/lib/validations/marketing";

export type {
  CouponFormValues,
  LoyaltyTierFormValues,
  SegmentFormValues,
  TemplateFormValues,
} from "@/lib/validations/marketing";
export {
  emptyCouponForm,
  emptyLoyaltyTierForm,
  emptySegmentForm,
  emptyTemplateForm,
  couponDateToApi,
} from "@/lib/validations/marketing";

type TemplateVariable = {
  key: string;
  placeholder: string;
  source: string;
  example: string;
};

export function TemplateFormFields({
  templateVars,
  preview,
  t,
}: {
  templateVars: TemplateVariable[];
  preview: { title: string; message: string } | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { values, setFieldValue } = useFormikContext<TemplateFormValues>();

  function insertTplVar(placeholder: string) {
    const body = values.body_template;
    void setFieldValue(
      "body_template",
      `${body}${body ? " " : ""}${placeholder}`
    );
  }

  return (
    <div className={formStackClass}>
      <FormikTextField name="name" label={t("common.name")} required />
      <FormikSelectField
        name="channel"
        label={t("marketing.channel")}
        options={[
          { value: "email", label: t("marketing.channelEmail") },
          { value: "in_app", label: t("marketing.channelInApp") },
          { value: "sms", label: t("marketing.channelSms") },
          { value: "whatsapp", label: t("marketing.channelWhatsapp") },
        ]}
      />
      <FormikTextField
        name="title_template"
        label={t("marketing.titleTemplate")}
        required
        placeholder="{{business}} offer for {{name}}"
      />
      <FormikTextField
        name="body_template"
        label={t("marketing.bodyTemplate")}
        type="textarea"
        rows={4}
        required
        placeholder="Hi {{name}}, … Use {{points}} for loyalty."
      />
      {templateVars.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("marketing.variablesTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            {templateVars.map((v) => (
              <button
                key={v.key}
                type="button"
                className="rounded-md border border-border bg-bg-tertiary px-2 py-1 font-mono text-xs text-heading hover:border-brand"
                onClick={() => insertTplVar(v.placeholder)}
              >
                {v.placeholder}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="rounded-md border border-border bg-white p-3 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">
            {t("marketing.preview")} ({values.channel})
          </p>
          <p className="mt-2 font-bold text-heading">{preview.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-body">{preview.message}</p>
          {values.channel === "sms" ? (
            <p className="mt-2 text-xs text-muted">
              {t("marketing.charsCount", { count: preview.message.length })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SegmentFormFields({
  t,
}: {
  t: (key: string) => string;
}) {
  return (
    <div className={formStackClass}>
      <FormikTextField name="name" label={t("common.name")} required />
      <FormikTextField
        name="min_points"
        label={t("marketing.minPoints")}
        type="number"
      />
      <FormikSwitchField name="khata" label={t("marketing.khataOnly")} />
    </div>
  );
}

function CouponCodeField({ label }: { label: string }) {
  const [field, meta, helpers] = useField("code");
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div>
      <Field label={label}>
        <input
          className={fieldClass}
          required
          value={field.value ?? ""}
          onChange={(e) => void helpers.setValue(e.target.value.toUpperCase())}
          onBlur={field.onBlur}
          name={field.name}
        />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function CouponFormFields({
  t,
}: {
  t: (key: string) => string;
}) {
  return (
    <div className={formStackClass}>
      <CouponCodeField label={t("marketing.couponCode")} />
      <div className={formGridClass}>
        <FormikSelectField
          name="discount_type"
          label={t("marketing.discountType")}
          options={[
            { value: "percent", label: t("marketing.discountPercent") },
            { value: "fixed", label: t("marketing.discountFixed") },
          ]}
        />
        <FormikTextField
          name="discount_value"
          label={t("marketing.discountValue")}
          required
        />
        <FormikDateTimeField
          name="valid_from"
          label={t("marketing.validFrom")}
          mode="datetime"
        />
        <FormikDateTimeField
          name="valid_to"
          label={t("marketing.validTo")}
          mode="datetime"
        />
        <FormikTextField name="usage_limit" label={t("marketing.usageLimit")} />
        <FormikTextField name="min_cart" label={t("marketing.minCart")} />
      </div>
      <p className="text-xs text-muted">{t("marketing.validityOptional")}</p>
      <FormikSwitchField name="stackable" label={t("marketing.stackable")} />
    </div>
  );
}

export function LoyaltyTierFormFields({
  t,
}: {
  t: (key: string) => string;
}) {
  return (
    <div className={formStackClass}>
      <div className={formGridClass}>
        <FormikTextField name="name" label={t("common.name")} required />
        <FormikTextField
          name="min_points"
          label={t("marketing.minPoints")}
          type="number"
          required
        />
        <FormikTextField name="earn_rate" label={t("marketing.earnRate")} />
        <FormikTextField name="redeem_rate" label={t("marketing.redeemRate")} />
      </div>
    </div>
  );
}
