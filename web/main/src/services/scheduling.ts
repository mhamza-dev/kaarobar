import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  Appointment,
  AppointmentStep,
  BookAppointmentPayload,
  DiaryColumn,
  QueueEntry,
  Resource,
  Slot,
} from "@/types/api/scheduling";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

export const listResources = () => get<Resource[]>("/scheduling/resources");
export const createResource = (payload: Partial<Resource>) =>
  post<Resource>("/scheduling/resources", payload);
export async function updateResource(id: string, payload: Partial<Resource>): Promise<Resource> {
  const response = await apiClient.patch<ApiEnvelope<Resource>>(
    `/scheduling/resources/${id}`,
    payload,
  );
  return response.data.data;
}
export const deleteResource = (id: string) => apiClient.delete(`/scheduling/resources/${id}`);

/** A day's diary: one column per resource with what it is booked for. */
export const getDiary = (date: string) => get<DiaryColumn[]>("/scheduling/diary", { date });

/** Free slots for one resource on one day, long enough for `duration_minutes`. */
export const getAvailability = (params: {
  resource_id: string;
  date: string;
  duration_minutes?: number;
}) => get<Slot[]>("/scheduling/availability", params);

export const listAppointments = (
  params: { from?: string; to?: string; status?: string; customer_id?: string } = {},
) => get<Appointment[]>("/appointments", params);

export const getAppointment = (id: string) => get<Appointment>(`/appointments/${id}`);

export const bookAppointment = (payload: BookAppointmentPayload) =>
  post<Appointment>("/appointments", payload);

export const advanceAppointment = (id: string, step: AppointmentStep) =>
  post<Appointment>(`/appointments/${id}/advance`, { step });

export const rescheduleAppointment = (id: string, startsAt: string) =>
  post<Appointment>(`/appointments/${id}/reschedule`, { starts_at: startsAt });

export const cancelAppointment = (id: string, reason?: string) =>
  post<Appointment>(`/appointments/${id}/cancel`, { reason });

export const markNoShow = (id: string) => post<Appointment>(`/appointments/${id}/no-show`);

// --- Walk-in queue --------------------------------------------------------------

export const listQueue = () => get<QueueEntry[]>("/queue");

export const joinQueue = (payload: {
  name: string;
  phone?: string;
  customer_id?: string;
  notes?: string;
}) => post<QueueEntry>("/queue", payload);

/** Seats someone from the bench: their wait becomes a booking, and they leave the queue. */
export const seatFromQueue = (id: string, payload: Partial<BookAppointmentPayload>) =>
  post<Appointment>(`/queue/${id}/seat`, payload);

export const callFromQueue = (id: string) => post<QueueEntry>(`/queue/${id}/call`);

export const leaveQueue = (id: string, status: "left" | "no_show" = "left") =>
  post<QueueEntry>(`/queue/${id}/leave`, { status });
