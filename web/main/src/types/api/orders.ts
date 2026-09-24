import type { Customer } from "./crm";

/** `SalesSerializers.order_item/1` — one line on an open ticket. */
export type OrderItem = {
  id: string;
  variant_id: string;
  name: string;
  quantity: string;
  billed_quantity: string;
  /** What is still to be paid for — a split bill settles part of a line. */
  unbilled_quantity: string;
  unit_price: string | null;
  line_total: string | null;
  seat_number: number | null;
  position: number | null;
  note: string | null;
};

/** `SalesSerializers.order/1` — an open ticket, priced by the backend. */
export type Order = {
  id: string;
  number: string;
  status: string;
  channel: string | null;
  label: string | null;
  branch_id: string | null;
  register_id: string | null;
  customer_id: string | null;
  service_mode: string | null;
  subtotal: string | null;
  discount_total: string | null;
  tax_total: string | null;
  total: string | null;
  notes: string | null;
  opened_at: string | null;
  billed_at: string | null;
  items?: OrderItem[] | null;
  customer?: Customer | null;
};

export type OrderItemInput = {
  variant_id: string;
  quantity: string;
  note?: string;
  seat_number?: number;
};
