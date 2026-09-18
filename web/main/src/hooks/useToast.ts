import { toast as sonnerToast } from "sonner";

import { ApiError } from "@/lib/api/errors";

/**
 * A thin wrapper over sonner so every mutation's `onError` can call one
 * helper (`toast.apiError(err)`) instead of each screen re-deriving a
 * message from an `ApiError` by hand.
 */
export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
  info: (message: string) => sonnerToast.info(message),
  apiError: (error: unknown) => {
    const message = error instanceof ApiError ? error.message : "Something went wrong.";
    sonnerToast.error(message);
  },
  /**
   * The default `onError` for a domain mutation hook.
   *
   * Stays quiet when the backend returned field-level validation errors,
   * because the form that submitted is about to render those inline (see
   * `applyApiFieldErrors`) and a toast saying "Validation failed" on top of
   * them is pure noise. Every other failure — a conflict, a permission
   * denial, the network being down — still toasts, so a mutation fired from
   * a row action with no form behind it can never fail silently.
   */
  mutationError: (error: unknown) => {
    if (error instanceof ApiError && error.fieldErrors) return;
    toast.apiError(error);
  },
};
