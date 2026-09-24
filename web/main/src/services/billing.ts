import { apiClient } from "@/lib/api/client";
import type { BillingInvoice, Plan, Subscription } from "@/types/api/billing";
import type { ApiEnvelope } from "@/types/api/common";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

export const listPlans = () => get<Plan[]>("/billing/plans");

/** `null` when the organization has never subscribed. */
export const getSubscription = () => get<Subscription | null>("/billing/subscription");

export async function subscribe(plan: string, skipTrial = false): Promise<Subscription> {
  const response = await apiClient.post<ApiEnvelope<Subscription>>("/billing/subscription", {
    plan,
    skip_trial: skipTrial,
  });
  return response.data.data;
}

export async function changePlan(plan: string): Promise<Subscription> {
  const response = await apiClient.put<ApiEnvelope<Subscription>>("/billing/subscription/plan", {
    plan,
  });
  return response.data.data;
}

/** At period end by default — `immediate` stops service now. */
export async function cancelSubscription(immediate = false): Promise<Subscription> {
  const response = await apiClient.delete<ApiEnvelope<Subscription>>("/billing/subscription", {
    params: { immediate },
  });
  return response.data.data;
}

export async function resumeSubscription(): Promise<Subscription> {
  const response = await apiClient.post<ApiEnvelope<Subscription>>(
    "/billing/subscription/resume",
    {},
  );
  return response.data.data;
}

export const listBillingInvoices = () => get<BillingInvoice[]>("/billing/invoices");
