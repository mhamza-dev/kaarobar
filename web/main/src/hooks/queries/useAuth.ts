import { useMutation, useQueryClient } from "@tanstack/react-query";

import * as authService from "@/services/auth";
import { useSessionStore } from "@/stores/sessionStore";
import { isMfaChallenge } from "@/types/api/auth";

import { meQueryKey } from "./useMe";

/** Owns setting the session token/cookie whenever a call returns one. */
function useAdoptSession() {
  const setToken = useSessionStore((state) => state.setToken);
  const queryClient = useQueryClient();

  return (token: string) => {
    setToken(token);
    // The next GET /me (fired by (app)/layout.tsx on navigation) resolves
    // the full scope for this token — invalidate rather than assume shape.
    void queryClient.invalidateQueries({ queryKey: meQueryKey });
  };
}

export function useRegister() {
  const adoptSession = useAdoptSession();
  return useMutation({
    mutationFn: authService.register,
    onSuccess: (session) => adoptSession(session.token),
  });
}

/** Returns the raw login result — the caller branches on `isMfaChallenge`. */
export function useLogin() {
  const adoptSession = useAdoptSession();
  return useMutation({
    mutationFn: authService.login,
    onSuccess: (result) => {
      if (!isMfaChallenge(result)) adoptSession(result.token);
    },
  });
}

export function useVerifyMfaChallenge() {
  const adoptSession = useAdoptSession();
  return useMutation({
    mutationFn: authService.verifyMfaChallenge,
    onSuccess: (session) => adoptSession(session.token),
  });
}

export function useLogout() {
  const clear = useSessionStore((state) => state.clear);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      // Sign the client out even if the backend call itself fails (token
      // already expired, network drop) — the user asked to leave.
      clear();
      queryClient.clear();
    },
  });
}
