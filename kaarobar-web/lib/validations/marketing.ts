import * as yup from "yup";

export type CampaignFormValues = {
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

export const emptyCampaignForm = (): CampaignFormValues => ({
  name: "",
  title: "",
  message: "",
  audience: "all",
  channel: "email",
  min_points: "",
  segment_id: "",
  coupon_id: "",
  template_id: "",
  budget_amount: "",
});

export const campaignFormSchema: yup.ObjectSchema<CampaignFormValues> = yup
  .object({
    name: yup.string().trim().required("Name is required"),
    title: yup.string().trim().required("Title is required"),
    message: yup.string().trim().required("Message is required"),
    audience: yup.string().default("all"),
    channel: yup.string().default("email"),
    min_points: yup.string().default(""),
    segment_id: yup.string().default(""),
    coupon_id: yup.string().default(""),
    template_id: yup.string().default(""),
    budget_amount: yup.string().default(""),
  })
  .test(
    "segment-required",
    "Select a segment",
    (values) =>
      values.audience !== "segment" || Boolean(values.segment_id?.trim())
  );

export type TemplateFormValues = {
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
};

export const emptyTemplateForm = (): TemplateFormValues => ({
  name: "",
  channel: "email",
  title_template: "",
  body_template: "",
});

export const templateFormSchema: yup.ObjectSchema<TemplateFormValues> = yup.object({
  name: yup.string().trim().required("Name is required"),
  channel: yup.string().required("Channel is required"),
  title_template: yup.string().trim().required("Title template is required"),
  body_template: yup.string().trim().required("Body template is required"),
});

export type SegmentFormValues = {
  name: string;
  min_points: string;
  khata: boolean;
};

export const emptySegmentForm = (): SegmentFormValues => ({
  name: "",
  min_points: "",
  khata: false,
});

export const segmentFormSchema: yup.ObjectSchema<SegmentFormValues> = yup.object({
  name: yup.string().trim().required("Name is required"),
  min_points: yup.string().default(""),
  khata: yup.boolean().default(false),
});

export type CouponFormValues = {
  code: string;
  discount_type: string;
  discount_value: string;
  valid_from: string;
  valid_to: string;
  usage_limit: string;
  min_cart: string;
  stackable: boolean;
};

export const emptyCouponForm = (): CouponFormValues => ({
  code: "",
  discount_type: "percent",
  discount_value: "",
  valid_from: "",
  valid_to: "",
  usage_limit: "",
  min_cart: "",
  stackable: false,
});

export const couponFormSchema: yup.ObjectSchema<CouponFormValues> = yup.object({
  code: yup.string().trim().required("Code is required"),
  discount_type: yup.string().required("Discount type is required"),
  discount_value: yup.string().trim().required("Discount value is required"),
  valid_from: yup.string().default(""),
  valid_to: yup.string().default(""),
  usage_limit: yup.string().default(""),
  min_cart: yup.string().default(""),
  stackable: yup.boolean().default(false),
});

/** `datetime-local` / DateTimePicker value → ISO UTC for Ecto `:utc_datetime`, or null if blank. */
export function couponDateToApi(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type LoyaltyTierFormValues = {
  name: string;
  min_points: string;
  earn_rate: string;
  redeem_rate: string;
};

export const emptyLoyaltyTierForm = (): LoyaltyTierFormValues => ({
  name: "",
  min_points: "0",
  earn_rate: "1",
  redeem_rate: "1",
});

export const loyaltyTierFormSchema: yup.ObjectSchema<LoyaltyTierFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    min_points: yup.string().trim().required("Min points is required"),
    earn_rate: yup.string().trim().required("Earn rate is required"),
    redeem_rate: yup.string().trim().required("Redeem rate is required"),
  });
