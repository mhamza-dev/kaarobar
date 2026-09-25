import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Scope } from "@/types/api/me";
import type { User } from "@/types/api/tenancy";

export async function getMe(): Promise<Scope> {
  const response = await apiClient.get<ApiEnvelope<Scope>>("/me");
  return response.data.data;
}

export type Device = {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  /** The session making this request — revoking it signs you out here. */
  current: boolean;
};

export type ProfilePayload = {
  name?: string;
  phone?: string | null;
  timezone?: string;
  locale?: string;
};

const put = async <T>(url: string, body: unknown) =>
  (await apiClient.put<ApiEnvelope<T>>(url, body)).data.data;
const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;

export async function updateProfile(payload: ProfilePayload): Promise<User> {
  return (await apiClient.patch<ApiEnvelope<User>>("/me", payload)).data.data;
}

/** Signs out every other device as well — the backend revokes their tokens. */
export const updatePassword = (payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) => put<{ message: string }>("/me/password", payload);

export const updateEmail = (payload: { current_password: string; email: string }) =>
  put<User>("/me/email", payload);

export async function listDevices(): Promise<Device[]> {
  return (await apiClient.get<ApiEnvelope<Device[]>>("/me/devices")).data.data;
}

export async function revokeDevice(id: string): Promise<void> {
  await apiClient.delete(`/me/devices/${id}`);
}

/**
 * Starts two-step sign-in: a fresh secret as an `otpauth://` URI, which is
 * what the QR code encodes. Not enforced until `confirmMfa` proves the app
 * can produce a matching code.
 */
export const enrollMfa = () => post<{ provisioning_uri: string }>("/me/mfa/enroll");
export const confirmMfa = (code: string) => post<User>("/me/mfa/confirm", { code });
export const disableMfa = (currentPassword: string) =>
  post<User>("/me/mfa/disable", { current_password: currentPassword });

/** Everything held about the caller personally, as one JSON document. */
export async function exportMyData(): Promise<unknown> {
  return (await apiClient.get<ApiEnvelope<unknown>>("/me/export")).data.data;
}

/** Scrubs the account and signs out everywhere. Irreversible. */
export const eraseMyData = (currentPassword: string) =>
  post<{ message: string }>("/me/erase", { current_password: currentPassword });
