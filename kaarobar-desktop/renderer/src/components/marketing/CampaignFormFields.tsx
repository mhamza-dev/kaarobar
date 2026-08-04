import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";

type CampaignForm = {
  name: string;
  title: string;
  message: string;
  audience: string;
  channel: string;
  min_points: string;
  segment_id: string;
  coupon_id: string;
  template_id: string;
  budget_amount: string;
};

type Option = { value: string; label: string };

export default function CampaignFormFields({
  form,
  onChange,
  templateOptions,
  segmentOptions,
  couponOptions,
  onTemplateApply,
  t,
}: {
  form: CampaignForm;
  onChange: (next: CampaignForm) => void;
  templateOptions: Option[];
  segmentOptions: Option[];
  couponOptions: Option[];
  onTemplateApply: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <Field label={t("marketing.internalName")}><input className={fieldClass} required value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} /></Field>
      <Field label="Template (optional)"><Select value={form.template_id} onChange={onTemplateApply} options={[{ value: "", label: "None — write freely" }, ...templateOptions]} triggerClassName="border-border bg-bg-secondary/80" /></Field>
      <Field label={t("marketing.notificationTitle")}><input className={fieldClass} required value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} /></Field>
      <Field label={t("marketing.message")}><textarea className={fieldClass} required rows={4} value={form.message} onChange={(e) => onChange({ ...form, message: e.target.value })} /></Field>
      <div className="rounded-md border border-border bg-bg-primary p-3 text-sm"><p className="mb-1 text-xs font-semibold uppercase text-muted">Message preview</p><p className="font-semibold text-heading">{form.title || "Title"}</p><p className="mt-1 whitespace-pre-wrap text-body">{form.message || "Message body…"}</p></div>
      <Field label="Channel"><Select value={form.channel} onChange={(v) => onChange({ ...form, channel: v })} options={[{ value: "email", label: "Email" }, { value: "in_app", label: "In-app" }, { value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }]} triggerClassName="border-border bg-bg-secondary/80" /></Field>
      <Field label="Budget (PKR)"><input className={fieldClass} type="number" min={0} step="0.01" placeholder={form.channel === "sms" || form.channel === "whatsapp" ? "Required for paid channels" : "Optional soft cap"} value={form.budget_amount} onChange={(e) => onChange({ ...form, budget_amount: e.target.value })} onBlur={() => { if (!form.budget_amount.trim()) return; onChange({ ...form, budget_amount: formatDecimal(form.budget_amount) }); }} /></Field>
      <Field label={t("marketing.audience")}><Select value={form.audience} onChange={(v) => onChange({ ...form, audience: v })} options={[{ value: "all", label: t("marketing.audienceAll") }, { value: "khata", label: t("marketing.audienceKhata") }, { value: "min_points", label: t("marketing.audienceMinPoints") }, { value: "segment", label: "Named segment" }]} triggerClassName="border-border bg-bg-secondary/80" /></Field>
      {form.audience === "min_points" ? <Field label={t("marketing.minPoints")}><input className={fieldClass} type="number" min={0} value={form.min_points} onChange={(e) => onChange({ ...form, min_points: e.target.value })} /></Field> : null}
      {form.audience === "segment" ? <Field label="Segment"><Select name="segment_id" required value={form.segment_id} onChange={(v) => onChange({ ...form, segment_id: v })} placeholder="Select…" options={segmentOptions} triggerClassName="border-border bg-bg-secondary/80" /></Field> : null}
      <Field label="Link coupon (optional)"><Select value={form.coupon_id} onChange={(v) => onChange({ ...form, coupon_id: v })} options={[{ value: "", label: "None" }, ...couponOptions]} triggerClassName="border-border bg-bg-secondary/80" /></Field>
    </>
  );
}
