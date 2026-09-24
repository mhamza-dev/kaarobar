import { useQuery } from "@tanstack/react-query";

import {
  advanceAppointment,
  bookAppointment,
  callFromQueue,
  cancelAppointment,
  createResource,
  deleteResource,
  getAppointment,
  getAvailability,
  getDiary,
  joinQueue,
  leaveQueue,
  listAppointments,
  listQueue,
  listResources,
  markNoShow,
  rescheduleAppointment,
  updateResource,
} from "@/services/scheduling";
import type {
  Appointment,
  AppointmentStep,
  BookAppointmentPayload,
  Resource,
} from "@/types/api/scheduling";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const BOOKING_KEYS = ["diary", "appointments", "appointment", "availability", "queue"];

export function useResources() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["resources", tenant], queryFn: listResources });
}

export const useCreateResource = () =>
  useInvalidatingMutation<[Partial<Resource>], unknown>(createResource, ["resources", "diary"]);
export const useUpdateResource = () =>
  useInvalidatingMutation<[string, Partial<Resource>], unknown>(updateResource, [
    "resources",
    "diary",
  ]);
export const useDeleteResource = () =>
  useInvalidatingMutation<[string], unknown>(deleteResource, ["resources", "diary"]);

export function useDiary(date: string) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["diary", tenant, date], queryFn: () => getDiary(date) });
}

export function useAvailability(
  params: { resource_id?: string; date: string; duration_minutes?: number },
  enabled = true,
) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["availability", tenant, params],
    queryFn: () =>
      getAvailability({
        resource_id: params.resource_id!,
        date: params.date,
        duration_minutes: params.duration_minutes,
      }),
    enabled: enabled && !!params.resource_id && !!params.date,
  });
}

export function useAppointments(params: { from?: string; to?: string; status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["appointments", tenant, params],
    queryFn: () => listAppointments(params),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: () => getAppointment(id!),
    enabled: !!id,
  });
}

export const useBookAppointment = () =>
  useInvalidatingMutation<[BookAppointmentPayload], Appointment>(bookAppointment, BOOKING_KEYS);
export const useAdvanceAppointment = () =>
  useInvalidatingMutation<[string, AppointmentStep], unknown>(advanceAppointment, BOOKING_KEYS);
export const useRescheduleAppointment = () =>
  useInvalidatingMutation<[string, string], unknown>(rescheduleAppointment, BOOKING_KEYS);
export const useCancelAppointment = () =>
  useInvalidatingMutation<[string, string?], unknown>(cancelAppointment, BOOKING_KEYS);
export const useMarkNoShow = () =>
  useInvalidatingMutation<[string], unknown>(markNoShow, BOOKING_KEYS);

export function useQueue(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["queue", tenant],
    queryFn: listQueue,
    enabled,
    // Waiting minutes are server-computed and tick up on their own.
    refetchInterval: 30_000,
  });
}

export const useJoinQueue = () =>
  useInvalidatingMutation<[Parameters<typeof joinQueue>[0]], unknown>(joinQueue, ["queue"]);
export const useCallFromQueue = () =>
  useInvalidatingMutation<[string], unknown>(callFromQueue, ["queue"]);
export const useLeaveQueue = () =>
  useInvalidatingMutation<[string, ("left" | "no_show")?], unknown>(leaveQueue, ["queue"]);
