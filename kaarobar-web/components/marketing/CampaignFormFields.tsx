"use client";

import { useFormikContext } from "formik";
import Select from "@/components/ui/Select";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { Field } from "@/components/app/ui";
import type { CampaignFormValues } from "@/lib/validations/marketing";

export type { CampaignFormValues } from "@/lib/validations/marketing";
export { emptyCampaignForm } from "@/lib/validations/marketing";

type Option = { value: string; label: string };

type MsgTemplate = {
  id: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};

export default function CampaignFormFields({
  templateOptions,
  segmentOptions,
  couponOptions,
  templates,
  t,
}: {
  templateOptions: Option[];
  segmentOptions: Option[];
  couponOptions: Option[];
  templates: MsgTemplate[];
  t: (key: string) => string;
}) {
  const { values, setValues } = useFormikContext<CampaignFormValues>();

  function applyTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) {
      void setValues({ ...values, template_id: id });
      return;
    }
    const vars = tpl.variables || {};
    let title = tpl.title_template;
    let message = tpl.body_template;
    Object.entries(vars).forEach(([k, v]) => {
      title = title.replaceAll(`{{${k}}}`, String(v));
      message = message.replaceAll(`{{${k}}}`, String(v));
    });
    void setValues({
      ...values,
      template_id: id,
      channel: tpl.channel,
      title,
      message,
    });
  }

  return (
    <div className="grid gap-3">
      <FormikTextField
        name="name"
        label={t("marketing.internalName")}
        required
      />
      <Field label="Template (optional)">
        <Select
          value={values.template_id}
          onChange={applyTemplate}
          placeholder="None — write freely"
          options={[
            { value: "", label: "None — write freely" },
            ...templateOptions,
          ]}
        />
      </Field>
      <FormikTextField
        name="title"
        label={t("marketing.notificationTitle")}
        required
      />
      <FormikTextField
        name="message"
        label={t("marketing.message")}
        type="textarea"
        rows={4}
        required
      />
      <div className="rounded-md border border-border bg-bg-primary p-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase text-muted">
          Message preview
        </p>
        <p className="font-semibold text-heading">{values.title || "Title"}</p>
        <p className="mt-1 whitespace-pre-wrap text-body">
          {values.message || "Message body…"}
        </p>
      </div>
      <FormikSelectField
        name="channel"
        label="Channel"
        options={[
          { value: "email", label: "Email" },
          { value: "in_app", label: "In-app" },
          { value: "sms", label: "SMS" },
          { value: "whatsapp", label: "WhatsApp" },
        ]}
      />
      <FormikTextField
        name="budget_amount"
        label="Budget (PKR)"
        type="number"
        placeholder={
          values.channel === "sms" || values.channel === "whatsapp"
            ? "Required for paid channels"
            : "Optional soft cap"
        }
      />
      <FormikSelectField
        name="audience"
        label={t("marketing.audience")}
        options={[
          { value: "all", label: t("marketing.audienceAll") },
          { value: "credit", label: t("marketing.audienceKhata") },
          { value: "min_points", label: t("marketing.audienceMinPoints") },
          { value: "segment", label: t("marketing.audienceSegment") },
        ]}
      />
      {values.audience === "min_points" ? (
        <FormikTextField
          name="min_points"
          label={t("marketing.minPoints")}
          type="number"
        />
      ) : null}
      {values.audience === "segment" ? (
        <FormikSelectField
          name="segment_id"
          label="Segment"
          placeholder="Select…"
          options={[{ value: "", label: "Select…" }, ...segmentOptions]}
        />
      ) : null}
      <FormikSelectField
        name="coupon_id"
        label="Link coupon (optional)"
        placeholder="None"
        options={[{ value: "", label: "None" }, ...couponOptions]}
      />
    </div>
  );
}
