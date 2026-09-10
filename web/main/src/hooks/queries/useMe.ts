import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/services/me";

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
