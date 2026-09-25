import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  confirmMfa,
  disableMfa,
  enrollMfa,
  eraseMyData,
  getMe,
  listDevices,
  revokeDevice,
  updateEmail,
  updatePassword,
  updateProfile,
  type ProfilePayload,
} from "@/services/me";

export const meQueryKey = ["me"] as const;

/**
 * The session bootstrap query — `(app)/layout.tsx` is the only place this
 * is meant to drive rendering (loading/redirect-on-error); everywhere else
 * that needs the current scope should read `useSessionStore` directly
 * (already hydrated by the layout) rather than re-triggering this query.
 */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    enabled: options?.enabled ?? true,
    retry: false,
    staleTime: 60_000,
  });
}

/** Anything that changes who you are refreshes the session scope with it. */
function useAccountMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meQueryKey });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useDevices() {
  return useQuery({ queryKey: ["devices"], queryFn: listDevices });
}

export const useUpdateProfile = () => useAccountMutation<[ProfilePayload], unknown>(updateProfile);
export const useUpdatePassword = () =>
  useAccountMutation<
    [{ current_password: string; password: string; password_confirmation: string }],
    unknown
  >(updatePassword);
export const useUpdateEmail = () =>
  useAccountMutation<[{ current_password: string; email: string }], unknown>(updateEmail);
export const useRevokeDevice = () => useAccountMutation<[string], unknown>(revokeDevice);
export const useEnrollMfa = () => useAccountMutation<[], { provisioning_uri: string }>(enrollMfa);
export const useConfirmMfa = () => useAccountMutation<[string], unknown>(confirmMfa);
export const useDisableMfa = () => useAccountMutation<[string], unknown>(disableMfa);
export const useEraseMyData = () => useAccountMutation<[string], unknown>(eraseMyData);
