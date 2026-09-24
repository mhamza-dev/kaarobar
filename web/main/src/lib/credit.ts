import type { CreditAgeing, Customer } from "@/types/api/crm";

import { formatMoney } from "./format";

export type AgeingBucketKey =
  "current" | "days_1_30" | "days_31_60" | "days_61_90" | "days_over_90";

/**
 * The receivables buckets in the order a collections screen reads them —
 * not yet due first, worst last. Labels are relative to each customer's own
 * terms (`CrmSerializers.ageing/1` counts overdue days from the due date,
 * not the sale date), so "1–30" means "up to a month late", not "a month old".
 */
export const AGEING_BUCKETS: Array<{ key: AgeingBucketKey; label: string }> = [
  { key: "current", label: "Not yet due" },
  { key: "days_1_30", label: "1–30 days late" },
  { key: "days_31_60", label: "31–60 days late" },
  { key: "days_61_90", label: "61–90 days late" },
  { key: "days_over_90", label: "Over 90 days" },
];

/**
 * Each bucket's share of the total, for the bar under the headline figures.
 *
 * Presentation only — the amounts stay the backend's decimal strings; the
 * percentage is for a bar width, where float rounding is invisible.
 */
export function ageingShares(
  ageing: Pick<CreditAgeing, AgeingBucketKey | "total">,
): Array<{ key: AgeingBucketKey; label: string; amount: string | null; percent: number }> {
  const total = Number(ageing.total ?? 0);

  return AGEING_BUCKETS.map(({ key, label }) => {
    const amount = ageing[key];
    const value = Number(amount ?? 0);
    const percent = total > 0 && Number.isFinite(value) ? (value / total) * 100 : 0;
    return { key, label, amount, percent };
  });
}

/**
 * What a customer can still put on account, as a person reads it.
 *
 * The customer serializer sends the literal `"unlimited"` for an uncapped
 * line; a cash-only customer has no available credit at all, whatever the
 * figure says.
 */
export function availableCreditLabel(
  customer: Pick<Customer, "credit_allowed" | "available_credit">,
  currency: string,
): string {
  if (!customer.credit_allowed) return "Cash only";
  if (customer.available_credit === "unlimited" || customer.available_credit === null) {
    return "No limit";
  }
  return formatMoney(customer.available_credit, currency);
}
