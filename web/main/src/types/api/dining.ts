import type { Order } from "./orders";

/**
 * Mirrors `KaarobarWeb.DiningSerializers`. Elapsed times arrive computed
 * (`minutes_seated`, `elapsed_minutes`) — never derived from a timestamp
 * on the client, whose clock disagrees with the kitchen's.
 */

export const TABLE_SHAPES = ["square", "round", "rectangle", "booth", "bar"] as const;

export type Floor = {
  id: string;
  branch_id: string;
  name: string;
  position: number | null;
  is_active: boolean;
};

export type DiningTable = {
  id: string;
  branch_id: string;
  floor_id: string | null;
  floor?: Floor | null;
  name: string;
  seats: number | null;
  position_x: number | null;
  position_y: number | null;
  shape: string | null;
  placed: boolean;
  is_active: boolean;
};

export type TableSession = {
  id: string;
  dining_table_id: string;
  dining_table?: DiningTable | null;
  order_id: string | null;
  order?: Order | null;
  /** open | billed | closed | merged */
  status: string;
  covers: number | null;
  label: string | null;
  server_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  merged_into_id: string | null;
  notes: string | null;
};

export type FloorPlanEntry = {
  table: DiningTable;
  occupied: boolean;
  minutes_seated: number | null;
  session: TableSession | null;
};

export type KitchenStation = {
  id: string;
  branch_id: string;
  name: string;
  code: string | null;
  position: number | null;
  prep_minutes: number | null;
  display_group: string | null;
  screen: string | null;
  is_active: boolean;
};

export type TicketItem = {
  id: string;
  order_item_id: string | null;
  name: string;
  quantity: string;
  modifiers: unknown;
  note: string | null;
  seat_number: number | null;
  status: string;
  /** Pre-formatted by the backend: "2 × Chicken karahi (no chilli)". */
  display_line: string;
};

/** fired → preparing → ready → bumped; recall reopens a bumped ticket. */
export type KitchenTicket = {
  id: string;
  number: string | null;
  order_id: string | null;
  kitchen_station_id: string | null;
  status: string;
  course: number | null;
  table_label: string | null;
  service_mode: string | null;
  server_label: string | null;
  is_priority: boolean;
  notes: string | null;
  fired_at: string | null;
  started_at: string | null;
  bumped_at: string | null;
  recalled_at: string | null;
  items?: TicketItem[] | null;
};

export type BoardEntry = {
  ticket: KitchenTicket;
  station: KitchenStation | null;
  elapsed_minutes: number;
  minutes_late: number;
  late: boolean;
};
