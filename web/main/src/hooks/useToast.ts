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
};
