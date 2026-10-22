import { apiClient } from "@/lib/api/client";
import type {
  BillingInvoice,
  BillingStatus,
  HostedSession,
  Plan,
  PlanCatalogue,
  Subscription,
} from "@/types/api/billing";
import type { ApiEnvelope } from "@/types/api/common";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

/**
 * The public catalogue (`GET /plans`), so it works before sign-in too — the
 * register form shows the plan being signed up for. Kept whole rather than
 * unwrapped: `meta.checkout_enabled` is the half that says whether to offer
 * card payment.
 */
export async function listPlans(): Promise<PlanCatalogue> {
  const response = await apiClient.get<{ data: Plan[]; meta?: { checkout_enabled?: boolean } }>(
    "/plans",
  );
  return {
    plans: response.data.data,
    checkoutEnabled: response.data.meta?.checkout_enabled ?? false,
  };
}

/** `subscription` is `null` when the organization has no live subscription. */
export async function getSubscription(): Promise<BillingStatus> {
  const response = await apiClient.get<{
    data: Subscription | null;
    meta?: { trial_eligible?: boolean };
  }>("/billing/subscription");
  return {
    subscription: response.data.data,
    trialEligible: response.data.meta?.trial_eligible ?? false,
  };
}

export async function subscribe(plan: string, skipTrial = false): Promise<Subscription> {
  const response = await apiClient.post<ApiEnvelope<Subscription>>("/billing/subscription", {
    plan,
    skip_trial: skipTrial,
  });
  return response.data.data;
}

/**
 * Starts a plan for an account that has only just been created, before its
 * token is adopted into the session (see `useRegister`). The new owner has
 * exactly one organization, so the backend needs no tenant headers to know
 * whose subscription this is.
 */
export async function subscribeNewAccount(token: string, plan: string): Promise<Subscription> {
  const response = await apiClient.post<ApiEnvelope<Subscription>>(
    "/billing/subscription",
    { plan },
    { headers: { Authorization: `Bearer ${token}` } },
  );
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

/**
 * A Stripe Checkout session for a plan. Nothing changes until Stripe's
 * webhook confirms the payment — send the browser to `url` and let the
 * billing screen pick the result up when it comes back.
 */
export async function startCheckout(plan: string): Promise<HostedSession> {
  const response = await apiClient.post<ApiEnvelope<HostedSession>>("/billing/checkout", { plan });
  return response.data.data;
}

/** Stripe's customer portal — card, plan, cancellation for a card-billed subscription. */
export async function openBillingPortal(): Promise<HostedSession> {
  const response = await apiClient.post<ApiEnvelope<HostedSession>>("/billing/portal", {});
  return response.data.data;
}
