import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  AuthSession,
  LoginInput,
  MfaChallenge,
  MfaVerifyInput,
  RegisterInput,
} from "@/types/api/auth";

export async function register(input: RegisterInput): Promise<AuthSession> {
  const response = await apiClient.post<ApiEnvelope<AuthSession>>("/auth/register", input);
  return response.data.data;
}

/** Either a normal session, or `{mfa_required: true, challenge}` — see `isMfaChallenge`. */
export async function login(input: LoginInput): Promise<AuthSession | MfaChallenge> {
  const response = await apiClient.post<ApiEnvelope<AuthSession | MfaChallenge>>(
    "/auth/login",
    input,
  );
  return response.data.data;
}

export async function verifyMfaChallenge(input: MfaVerifyInput): Promise<AuthSession> {
  const response = await apiClient.post<ApiEnvelope<AuthSession>>("/auth/mfa/verify", input);
  return response.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function logoutAll(): Promise<void> {
  await apiClient.post("/auth/logout-all");
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPassword(input: {
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await apiClient.post("/auth/reset-password", input);
}
