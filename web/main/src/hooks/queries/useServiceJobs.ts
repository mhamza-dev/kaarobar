import { useQuery } from "@tanstack/react-query";

import {
  addServiceJobNote,
  cancelServiceJob,
  createServiceJob,
  deliverServiceJob,
  getServiceJob,
  getServiceJobHistory,
  holdServiceJob,
  listServiceJobs,
  markServiceJobReady,
  moveServiceJobItem,
  reportServiceJobIncident,
  startServiceJob,
} from "@/services/serviceJobs";
import type { ServiceJob, ServiceJobPayload } from "@/types/api/serviceJobs";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const JOB_KEYS = ["service-jobs", "service-job"];

export function useServiceJobs(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["service-jobs", tenant, params],
    queryFn: () => listServiceJobs(params),
  });
}

export function useServiceJob(id: string | undefined) {
  return useQuery({
    queryKey: ["service-job", id],
    queryFn: () => getServiceJob(id!),
    enabled: !!id,
  });
}

export function useServiceJobHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["service-job", id, "history"],
    queryFn: () => getServiceJobHistory(id!),
    enabled: !!id,
  });
}

export const useCreateServiceJob = () =>
  useInvalidatingMutation<[ServiceJobPayload], ServiceJob>(createServiceJob, JOB_KEYS);
export const useMoveServiceJobItem = () =>
  useInvalidatingMutation<[string, string, string], unknown>(moveServiceJobItem, JOB_KEYS);
export const useReportServiceJobIncident = () =>
  useInvalidatingMutation<[string, string, "lost" | "damaged", string?], unknown>(
    reportServiceJobIncident,
    JOB_KEYS,
  );
export const useStartServiceJob = () =>
  useInvalidatingMutation<[string], unknown>(startServiceJob, JOB_KEYS);
export const useMarkServiceJobReady = () =>
  useInvalidatingMutation<[string, string?], unknown>(markServiceJobReady, JOB_KEYS);
export const useDeliverServiceJob = () =>
  useInvalidatingMutation<[string, boolean?], unknown>(deliverServiceJob, JOB_KEYS);
export const useHoldServiceJob = () =>
  useInvalidatingMutation<[string, string], unknown>(holdServiceJob, JOB_KEYS);
export const useCancelServiceJob = () =>
  useInvalidatingMutation<[string, string?], unknown>(cancelServiceJob, JOB_KEYS);
export const useAddServiceJobNote = () =>
  useInvalidatingMutation<[string, string], unknown>(addServiceJobNote, JOB_KEYS);
