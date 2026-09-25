/** Deliveries, commissions and time entries — mirrors dining/vertical/trade serializers. */

import type { Customer } from "./crm";

export const DELIVERY_STATUSES = [
  "pending",
  "assigned",
  "picked_up",
  "delivered",
  "failed",
  "cancelled",
] as const;

export type Delivery = {
  id: string;
  number: string;
  status: (typeof DELIVERY_STATUSES)[number] | string;
  order_id: string | null;
  sale_id: string | null;
  customer_id: string | null;
  customer: Customer | null;
  rider_user_id: string | null;
  rider_label: string | null;
  address: string;
  phone: string | null;
  delivery_notes: string | null;
  fee: string | null;
  /** Cash the rider took at the door. */
  collected_amount: string | null;
  promised_at: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  /** Past the promised time, by the server's clock; null when not late. */
  minutes_late: number | null;
};

export type DeliveryPayload = {
  address_snapshot: string;
  phone_snapshot?: string | null;
  customer_id?: string | null;
  sale_id?: string | null;
  order_id?: string | null;
  delivery_notes?: string | null;
  fee?: string | null;
  promised_at?: string | null;
};

/** What one rider is carrying, and the cash they owe back. */
export type RiderRound = {
  rider_user_id: string;
  rider_label: string | null;
  count: number;
  late_count: number;
  cash_out: string | null;
  deliveries: Delivery[];
};

export const COMMISSION_BASES = ["percent_of_net", "percent_of_margin", "flat_per_item"] as const;

/** Who earns what on which sales — the most specific matching rule wins. */
export type CommissionRule = {
  id: string;
  name: string;
  user_id: string | null;
  variant_id: string | null;
  category_id: string | null;
  basis: (typeof COMMISSION_BASES)[number] | string;
  /** A fraction for percentage bases — 0.05 is 5%. */
  rate: string | null;
  flat_amount: string | null;
  min_sales_amount: string | null;
  priority: number;
  specificity: number;
  is_active: boolean;
};

export type CommissionRulePayload = {
  name: string;
  basis: string;
  user_id?: string | null;
  category_id?: string | null;
  rate?: string | null;
  flat_amount?: string | null;
  priority?: number;
  is_active?: boolean;
};

export type CommissionEntry = {
  id: string;
  user_id: string;
  sale_id: string | null;
  sale_item_id: string | null;
  commission_rule_id: string | null;
  basis: string;
  rate: string | null;
  base_amount: string | null;
  amount: string;
  status: "accrued" | "approved" | "paid" | "reversed" | string;
  earned_on: string;
  paid_at: string | null;
  reversed_at: string | null;
  note: string | null;
};

export type CommissionStatement = {
  user_id: string;
  from: string;
  to: string;
  earned: string;
  reversed: string;
  paid: string;
  entries: CommissionEntry[];
};

export type CommissionSummaryRow = { user_id: string; amount: string; line_count: number };

export type TimeEntry = {
  id: string;
  user_id: string;
  customer_id: string | null;
  service_job_id: string | null;
  description: string;
  worked_on: string;
  minutes: number;
  hours: string;
  is_billable: boolean;
  hourly_rate: string | null;
  amount: string | null;
  billed_at: string | null;
  sale_id: string | null;
  unbilled: boolean;
  notes: string | null;
};

export type TimeEntryPayload = {
  description: string;
  worked_on: string;
  minutes: number;
  is_billable?: boolean;
  hourly_rate?: string | null;
  customer_id?: string | null;
  user_id?: string | null;
  notes?: string | null;
};

export type UtilisationRow = {
  user_id: string;
  billable_minutes: number;
  non_billable_minutes: number;
  amount: string | null;
};
