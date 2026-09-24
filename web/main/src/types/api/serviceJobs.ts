import type { Customer } from "./crm";

/** Mirrors the service-desk half of `KaarobarWeb.VerticalSerializers`. */

export const JOB_STATUSES = [
  "intake",
  "in_progress",
  "ready",
  "delivered",
  "on_hold",
  "cancelled",
] as const;
export const JOB_PRIORITIES = ["normal", "express", "urgent"] as const;

export type JobItem = {
  id: string;
  variant_id: string | null;
  description: string | null;
  quantity: string;
  unit_price: string | null;
  line_total: string | null;
  tag_code: string | null;
  label: string | null;
  condition_notes: string | null;
  colour: string | null;
  brand: string | null;
  serial_number: string | null;
  status: string;
  rack_location: string | null;
  notes: string | null;
};

export type ServiceJob = {
  id: string;
  number: string;
  status: string;
  priority: string;
  who: string | null;
  customer_id: string | null;
  customer?: Customer | null;
  walk_in_name: string | null;
  walk_in_phone: string | null;
  promised_on: string | null;
  /** Server-computed against its today. */
  overdue: boolean;
  received_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancel_reason: string | null;
  quoted_total: string | null;
  advance_paid: string | null;
  balance_due: string | null;
  sale_id: string | null;
  rack_location: string | null;
  fulfilment: string | null;
  notes: string | null;
  items?: JobItem[] | null;
};

export type JobEvent = {
  id: string;
  kind: string;
  summary: string | null;
  detail: unknown;
  service_job_item_id: string | null;
  actor_label: string | null;
  occurred_at: string;
};

export type ServiceJobPayload = {
  customer_id?: string;
  walk_in_name?: string;
  walk_in_phone?: string;
  priority?: string;
  promised_on?: string;
  notes?: string;
  items: Array<{
    variant_id?: string;
    description: string;
    quantity: string;
    unit_price?: string;
    tag_code?: string;
    condition_notes?: string;
    colour?: string;
    brand?: string;
    serial_number?: string;
  }>;
};
