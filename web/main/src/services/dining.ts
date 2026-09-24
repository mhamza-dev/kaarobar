import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  BoardEntry,
  DiningTable,
  Floor,
  FloorPlanEntry,
  KitchenStation,
  KitchenTicket,
  TableSession,
} from "@/types/api/dining";
import type { Order, OrderItemInput } from "@/types/api/orders";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

async function patch<T>(path: string, body: object): Promise<T> {
  const response = await apiClient.patch<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

// --- The floor ------------------------------------------------------------------

/** Every table with whoever is sitting at it — the host stand's one call. */
export const getFloorPlan = () => get<FloorPlanEntry[]>("/dining/floor-plan");

export const listFloors = () => get<Floor[]>("/dining/floors");
export const createFloor = (payload: Partial<Floor>) => post<Floor>("/dining/floors", payload);
export const updateFloor = (id: string, payload: Partial<Floor>) =>
  patch<Floor>(`/dining/floors/${id}`, payload);
export const deleteFloor = (id: string) => apiClient.delete(`/dining/floors/${id}`);

export const listTables = () => get<DiningTable[]>("/dining/tables");
export const createTable = (payload: Partial<DiningTable>) =>
  post<DiningTable>("/dining/tables", payload);
export const updateTable = (id: string, payload: Partial<DiningTable>) =>
  patch<DiningTable>(`/dining/tables/${id}`, payload);
export const deleteTable = (id: string) => apiClient.delete(`/dining/tables/${id}`);

// --- Sittings -------------------------------------------------------------------

export const getSession = (id: string) => get<TableSession>(`/dining/sessions/${id}`);

/** Seats a party and opens their bill in one call. */
export const seatTable = (payload: {
  table_id: string;
  covers?: number;
  label?: string;
  notes?: string;
}) => post<TableSession>("/dining/sessions", payload);

export const transferSession = (id: string, tableId: string) =>
  post<TableSession>(`/dining/sessions/${id}/transfer`, { table_id: tableId });

export const markSessionBilled = (id: string) => post<TableSession>(`/dining/sessions/${id}/bill`);

export const closeSession = (id: string) => post<TableSession>(`/dining/sessions/${id}/close`);

// --- The table's order ----------------------------------------------------------

export const getOrder = (id: string) => get<Order>(`/orders/${id}`);

export const addOrderItems = (orderId: string, items: OrderItemInput[]) =>
  post<Order>(`/orders/${orderId}/items`, { items });

export async function removeOrderItem(orderId: string, itemId: string): Promise<Order> {
  const response = await apiClient.delete<ApiEnvelope<Order>>(`/orders/${orderId}/items/${itemId}`);
  return response.data.data;
}

// --- The kitchen ----------------------------------------------------------------

/** Live tickets with their clocks already computed by the server. */
export const getKitchenBoard = (params: { station_id?: string } = {}) =>
  get<BoardEntry[]>("/kitchen/board", params);

export const listStations = () => get<KitchenStation[]>("/kitchen/stations");
export const createStation = (payload: Partial<KitchenStation>) =>
  post<KitchenStation>("/kitchen/stations", payload);
export const updateStation = (id: string, payload: Partial<KitchenStation>) =>
  patch<KitchenStation>(`/kitchen/stations/${id}`, payload);
export const deleteStation = (id: string) => apiClient.delete(`/kitchen/stations/${id}`);

/** Sends an order's unfired lines to the kitchen, split per station. */
export const fireOrder = (payload: { order_id: string; course?: number; notes?: string }) =>
  post<KitchenTicket[]>("/kitchen/fire", payload);

export type TicketAction = "start" | "ready" | "bump" | "recall";

export const advanceTicket = (id: string, action: TicketAction) =>
  post<KitchenTicket>(`/kitchen/tickets/${id}/${action}`);
