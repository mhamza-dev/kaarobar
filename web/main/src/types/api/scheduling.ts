import type { Customer } from "./crm";

/** Mirrors the scheduling half of `KaarobarWeb.VerticalSerializers`. */

export const RESOURCE_KINDS = ["staff", "chair", "room", "equipment", "bay", "other"] as const;

export type Resource = {
  id: string;
  branch_id: string;
  name: string;
  kind: string;
  user_id: string | null;
  colour: string | null;
  position: number | null;
  working_hours: unknown;
  is_bookable: boolean;
  /** Server-computed: bookable flag and active. */
  bookable: boolean;
  is_active: boolean;
};

export type Slot = { starts_at: string; ends_at: string };

export type AppointmentService = {
  id: string;
  appointment_id: string;
  variant_id: string;
  resource_id: string | null;
  resource?: Resource | null;
  name: string;
  duration_minutes: number;
  price: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
};

/** booked → confirmed → arrived → in_progress → completed; or cancelled / no_show. */
export type Appointment = {
  id: string;
  number: string;
  status: string;
  source: string | null;
  /** Customer name or walk-in name, resolved server-side. */
  who: string | null;
  customer_id: string | null;
  customer?: Customer | null;
  walk_in_name: string | null;
  walk_in_phone: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  notes: string | null;
  order_id: string | null;
  sale_id: string | null;
  cancel_reason: string | null;
  services?: AppointmentService[] | null;
};

export type AppointmentStep = "confirm" | "arrive" | "start" | "complete";

export type DiaryColumn = {
  resource: Resource;
  services: AppointmentService[];
};

export type QueueEntry = {
  id: string;
  name: string | null;
  phone: string | null;
  customer_id: string | null;
  variant_id: string | null;
  requested_resource_id: string | null;
  requested_resource?: Resource | null;
  /** waiting | called | seated | left | no_show */
  status: string;
  position: number | null;
  notes: string | null;
  joined_at: string | null;
  called_at: string | null;
  seated_at: string | null;
  appointment_id: string | null;
  minutes_waiting?: number;
};

export type BookAppointmentPayload = {
  customer_id?: string;
  walk_in_name?: string;
  walk_in_phone?: string;
  source?: string;
  notes?: string;
  services: Array<{ variant_id: string; resource_id: string; starts_at: string }>;
};
