import type { Customer } from "./crm";

/** Mirrors the hire half of `KaarobarWeb.TradeSerializers`. */

export const UNIT_STATUSES = [
  "available",
  "on_hire",
  "reserved",
  "maintenance",
  "lost",
  "retired",
] as const;
export const RETURN_CONDITIONS = ["good", "damaged", "lost", "late"] as const;

export type RentalUnit = {
  id: string;
  branch_id: string;
  variant_id: string;
  asset_code: string;
  serial_number: string | null;
  condition_notes: string | null;
  status: string;
  daily_rate: string | null;
  deposit_amount: string | null;
  acquired_on: string | null;
  hireable: boolean;
  is_active: boolean;
};

export type AgreementLine = {
  id: string;
  rental_unit_id: string;
  rental_unit?: RentalUnit | null;
  name: string | null;
  daily_rate: string | null;
  deposit_amount: string | null;
  held_from: string | null;
  held_until: string | null;
  returned_at: string | null;
  return_condition: string | null;
  out: boolean;
};

/** reserved → on_hire → returned; or overdue / cancelled / written_off. */
export type RentalAgreement = {
  id: string;
  number: string;
  status: string;
  customer_id: string | null;
  customer?: Customer | null;
  starts_at: string | null;
  due_back_at: string | null;
  returned_at: string | null;
  days_late: number | null;
  hire_total: string | null;
  deposit_held: string | null;
  deposit_returned: string | null;
  late_fee: string | null;
  damage_fee: string | null;
  total_due: string | null;
  sale_id: string | null;
  notes: string | null;
  cancel_reason: string | null;
  lines?: AgreementLine[] | null;
};
