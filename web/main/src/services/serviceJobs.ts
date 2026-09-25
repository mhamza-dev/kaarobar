import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { JobEvent, ServiceJob, ServiceJobPayload } from "@/types/api/serviceJobs";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

export const listServiceJobs = (params: { status?: string; customer_id?: string } = {}) =>
  get<ServiceJob[]>("/service-jobs", params);

export const listOverdueJobs = () => get<ServiceJob[]>("/service-jobs/overdue");

export const getServiceJob = (id: string) => get<ServiceJob>(`/service-jobs/${id}`);

/** The counter's lookup: a ticket tag is how a customer's item is found. */
export const getServiceJobByTag = (tag: string) =>
  get<ServiceJob>(`/service-jobs/by-tag/${encodeURIComponent(tag)}`);

export const getServiceJobHistory = (id: string) => get<JobEvent[]>(`/service-jobs/${id}/history`);

export const createServiceJob = (payload: ServiceJobPayload) =>
  post<ServiceJob>("/service-jobs", payload);

export const startServiceJob = (id: string) => post<ServiceJob>(`/service-jobs/${id}/start`);

export const markServiceJobReady = (id: string, rackLocation?: string) =>
  post<ServiceJob>(`/service-jobs/${id}/ready`, { rack_location: rackLocation });

/** Refused while a balance is due unless `allow_unpaid` — handing over unpaid work is a choice. */
export const deliverServiceJob = (id: string, allowUnpaid = false) =>
  post<ServiceJob>(`/service-jobs/${id}/deliver`, { allow_unpaid: allowUnpaid });

export const holdServiceJob = (id: string, reason: string) =>
  post<ServiceJob>(`/service-jobs/${id}/hold`, { reason });

export const cancelServiceJob = (id: string, reason?: string) =>
  post<ServiceJob>(`/service-jobs/${id}/cancel`, { reason });

/** Records where one item now sits — a job's items can end up on different racks. */
export const moveServiceJobItem = (id: string, itemId: string, rackLocation: string) =>
  post<unknown>(`/service-jobs/${id}/items/${itemId}/move`, { rack_location: rackLocation });

/** Something was lost or damaged while the shop had it. */
export const reportServiceJobIncident = (
  id: string,
  itemId: string,
  status: "lost" | "damaged",
  notes?: string,
) => post<unknown>(`/service-jobs/${id}/items/${itemId}/incident`, { status, notes });

export const addServiceJobNote = (id: string, summary: string) =>
  post<JobEvent>(`/service-jobs/${id}/notes`, { summary });
