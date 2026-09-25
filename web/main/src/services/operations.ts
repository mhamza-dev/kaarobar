import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Order } from "@/types/api/orders";
import type {
  CommissionRule,
  CommissionRulePayload,
  CommissionStatement,
  CommissionSummaryRow,
  Delivery,
  DeliveryPayload,
  RiderRound,
  TimeEntry,
  TimeEntryPayload,
  UtilisationRow,
} from "@/types/api/operations";

const get = async <T>(url: string, params?: object) =>
  (await apiClient.get<ApiEnvelope<T>>(url, { params })).data.data;
const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;
const patch = async <T>(url: string, body: unknown) =>
  (await apiClient.patch<ApiEnvelope<T>>(url, body)).data.data;

// --- Deliveries ------------------------------------------------------------------

/** Still out or waiting to go, oldest promise first — or one status. */
export const listDeliveries = (params: { status?: string; rider_user_id?: string } = {}) =>
  get<Delivery[]>("/deliveries", params);
export const getDelivery = (id: string) => get<Delivery>(`/deliveries/${id}`);
export const getRiderBoard = () => get<RiderRound[]>("/deliveries/riders");
export const createDelivery = (payload: DeliveryPayload) => post<Delivery>("/deliveries", payload);
export const assignDelivery = (id: string, riderUserId: string) =>
  post<Delivery>(`/deliveries/${id}/assign`, { rider_user_id: riderUserId });
export const pickUpDelivery = (id: string) => post<Delivery>(`/deliveries/${id}/pick-up`);
/** `collected` is the cash taken at the door, if any. */
export const completeDelivery = (id: string, collected?: string | null) =>
  post<Delivery>(`/deliveries/${id}/deliver`, collected ? { collected } : {});
export const failDelivery = (id: string, reason: string) =>
  post<Delivery>(`/deliveries/${id}/fail`, { reason });
export const cancelDelivery = (id: string) => post<Delivery>(`/deliveries/${id}/cancel`);

// --- Commissions -------------------------------------------------------------------

export const listCommissionRules = () => get<CommissionRule[]>("/commissions/rules");
export const createCommissionRule = (payload: CommissionRulePayload) =>
  post<CommissionRule>("/commissions/rules", payload);
export const updateCommissionRule = (id: string, payload: Partial<CommissionRulePayload>) =>
  patch<CommissionRule>(`/commissions/rules/${id}`, payload);
export async function deleteCommissionRule(id: string): Promise<void> {
  await apiClient.delete(`/commissions/rules/${id}`);
}
export const getCommissionSummary = (from: string, to: string) =>
  get<CommissionSummaryRow[]>("/commissions/summary", { from, to });
export const getCommissionStatement = (userId: string, from: string, to: string) =>
  get<CommissionStatement>(`/commissions/statement/${userId}`, { from, to });
export const approveCommissions = (ids: string[]) =>
  post<{ approved: number }>("/commissions/approve", { ids });
export const payCommissions = (ids: string[]) =>
  post<{ paid: number }>("/commissions/pay", { ids });

// --- Time --------------------------------------------------------------------------

export const listTimeEntries = (params: { user_id?: string; from?: string; to?: string } = {}) =>
  get<TimeEntry[]>("/time-entries", params);
export const logTime = (payload: TimeEntryPayload) => post<TimeEntry>("/time-entries", payload);
export const updateTimeEntry = (id: string, payload: Partial<TimeEntryPayload>) =>
  patch<TimeEntry>(`/time-entries/${id}`, payload);
export async function deleteTimeEntry(id: string): Promise<void> {
  await apiClient.delete(`/time-entries/${id}`);
}
/** Unbilled billable time, with its total minutes and value. */
export async function getUnbilledTime(): Promise<{
  entries: TimeEntry[];
  minutes: number;
  amount: string | null;
}> {
  const response = await apiClient.get<{
    data: TimeEntry[];
    meta: { minutes: number; amount: string | null };
  }>("/time-entries/unbilled");
  return { entries: response.data.data, ...response.data.meta };
}
export const getUtilisation = (from: string, to: string) =>
  get<UtilisationRow[]>("/time-entries/utilisation", { from, to });

/** Open orders — what a delivery can be attached to before it's paid for. */
export const listOpenOrders = () => get<Order[]>("/orders", { status: "open" });
