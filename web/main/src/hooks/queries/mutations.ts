import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";

/**
 * A domain mutation that refreshes a set of query-key prefixes on success
 * and toasts on failure (quietly when the form will render field errors —
 * see `toast.mutationError`).
 *
 * The vertical modules each have several transitions that all move the
 * same few lists, so they name the prefixes once rather than hand-writing
 * a `useXMutation` per domain.
 */
export function useInvalidatingMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  keys: readonly string[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => toast.mutationError(error),
  });
}
