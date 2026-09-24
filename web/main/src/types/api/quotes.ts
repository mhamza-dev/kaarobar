import type { Customer } from "./crm";

/** Mirrors the professional-services half of `KaarobarWeb.TradeSerializers`. */

export type QuoteLineItem = {
  id: string;
  variant_id: string | null;
  description: string;
  quantity: string;
  unit_price: string | null;
  discount: string | null;
  line_total: string | null;
};

/** draft → sent → accepted | declined; lapses past valid_until. */
export type Quote = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  customer_id: string | null;
  customer?: Customer | null;
  currency: string | null;
  subtotal: string | null;
  discount_total: string | null;
  tax_total: string | null;
  total: string | null;
  valid_until: string | null;
  lapsed: boolean;
  notes: string | null;
  terms: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  service_job_id: string | null;
  sale_id: string | null;
  lines?: QuoteLineItem[] | null;
};

export type QuoteLineInput = {
  variant_id?: string;
  description: string;
  quantity: string;
  unit_price?: string;
  discount?: string;
};

export type QuotePayload = {
  customer_id?: string;
  title?: string;
  valid_until?: string;
  notes?: string;
  terms?: string;
  lines: QuoteLineInput[];
};

export type WinRate = {
  from: string;
  to: string;
  quoted_count: number;
  decided_count: number;
  won_count: number;
  quoted_value: string | null;
  won_value: string | null;
  win_rate: string | null;
};
