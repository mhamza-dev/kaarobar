import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { RentalAgreement, RentalUnit } from "@/types/api/rentals";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

export const listRentalUnits = (params: { status?: string } = {}) =>
  get<RentalUnit[]>("/rentals/units", params);

/** Units free for the whole of `[from, to)` — what a booking can pick from. */
export const listAvailableUnits = (from: string, to: string) =>
  get<RentalUnit[]>("/rentals/available", { from, to });

export const createRentalUnit = (payload: Partial<RentalUnit>) =>
  post<RentalUnit>("/rentals/units", payload);

export async function updateRentalUnit(
  id: string,
  payload: Partial<RentalUnit>,
): Promise<RentalUnit> {
  const response = await apiClient.patch<ApiEnvelope<RentalUnit>>(`/rentals/units/${id}`, payload);
  return response.data.data;
}

export const listRentals = (params: { status?: string; customer_id?: string } = {}) =>
  get<RentalAgreement[]>("/rentals", params);

export const getRental = (id: string) => get<RentalAgreement>(`/rentals/${id}`);

/** Totals are computed by the backend from rates and dates — never sent. */
export const bookRental = (payload: {
  customer_id: string;
  starts_at: string;
  due_back_at: string;
  unit_ids: string[];
  notes?: string;
}) => post<RentalAgreement>("/rentals", payload);

export const issueRental = (id: string) => post<RentalAgreement>(`/rentals/${id}/issue`);

/** `conditions` maps agreement line id → good | damaged | lost | late. */
export const returnRental = (
  id: string,
  payload: { conditions?: Record<string, string>; damage_fee?: string; late_fee?: string },
) => post<RentalAgreement>(`/rentals/${id}/return`, payload);

export const cancelRental = (id: string, reason?: string) =>
  post<RentalAgreement>(`/rentals/${id}/cancel`, { reason });
