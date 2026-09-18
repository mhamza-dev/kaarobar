import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  revokeInvitation,
} from "@/services/invitations";
import type { InvitePayload } from "@/types/api/staffing";

import { useTenantKey } from "./keys";

export function useInvitationsList() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["invitations", tenant],
    queryFn: listInvitations,
  });
}

function useInvitationMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateInvitation() {
  return useInvitationMutation<[InvitePayload], unknown>(createInvitation);
}

export function useRevokeInvitation() {
  return useInvitationMutation<[string], unknown>(revokeInvitation);
}

/**
 * The unauthenticated invitee side. Not tenant-keyed and not retried: the
 * token is either valid or it is not, and retrying a bad one just delays
 * telling the invitee their link expired.
 */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => previewInvitation(token),
    retry: false,
    enabled: !!token,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (variables: { token: string; user?: { name?: string; password?: string } }) =>
      acceptInvitation(variables.token, variables.user),
  });
}
