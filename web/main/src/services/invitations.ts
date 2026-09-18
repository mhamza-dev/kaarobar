import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { AuthSession } from "@/types/api/auth";
import type { Invitation, InvitationPreview, InvitePayload } from "@/types/api/staffing";

export async function listInvitations(): Promise<Invitation[]> {
  const response = await apiClient.get<ApiEnvelope<Invitation[]>>("/invitations");
  return response.data.data;
}

export async function createInvitation(payload: InvitePayload): Promise<Invitation> {
  const response = await apiClient.post<ApiEnvelope<Invitation>>("/invitations", payload);
  return response.data.data;
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`/invitations/${id}`);
}

/** Unauthenticated: the invitee has a token from their email, not a session. */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const response = await apiClient.get<ApiEnvelope<InvitationPreview>>(`/invitations/${token}`);
  return response.data.data;
}

/**
 * Accepts an invitation and returns a **session** — the backend signs the
 * invitee in as part of accepting (`InvitationController.accept/2` renders
 * `AuthJSON.session`), so the accept screen lands them in the app rather
 * than bouncing them to a login form.
 *
 * `user` carries the new account's name/password, and is ignored by the
 * backend when the email already has an account.
 */
export async function acceptInvitation(
  token: string,
  user?: { name?: string; password?: string },
): Promise<AuthSession> {
  const response = await apiClient.post<ApiEnvelope<AuthSession>>(`/invitations/${token}/accept`, {
    user,
  });
  return response.data.data;
}
