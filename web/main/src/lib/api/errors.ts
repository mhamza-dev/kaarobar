import type { AxiosError } from "axios";

import type { ApiErrorBody } from "@/types/api/common";

/**
 * The backend's `{"error": {"code","message","details"}}` envelope, typed.
 *
 * `fieldErrors` is what a form's submit handler feeds to Formik's
 * `setErrors` — present only when `details` had field-keyed validation
 * messages (the `validation_failed` case); every other error code carries a
 * flat `message` meant to be shown directly (a toast, an inline banner).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly fieldErrors: Record<string, string> | null;

  constructor(
    message: string,
    code: string,
    status: number | null,
    fieldErrors: Record<string, string> | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function flattenFieldErrors(
  details: ApiErrorBody["error"]["details"],
): Record<string, string> | null {
  if (!details) return null;

  const flattened: Record<string, string> = {};
  for (const [field, value] of Object.entries(details)) {
    flattened[field] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return Object.keys(flattened).length > 0 ? flattened : null;
}

/** Turns any axios error (or anything else) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<ApiErrorBody>;

  if (axiosError.isAxiosError) {
    if (!axiosError.response) {
      // No response at all — the network is down, the backend is
      // unreachable, or a CORS/timeout failure. Distinct from a real 4xx/5xx.
      return new ApiError(
        "Could not reach the server. Check your connection and try again.",
        "network_error",
        null,
        null,
      );
    }

    const body = axiosError.response.data;
    const status = axiosError.response.status;

    if (body?.error) {
      return new ApiError(
        body.error.message,
        body.error.code,
        status,
        flattenFieldErrors(body.error.details),
      );
    }

    return new ApiError(
      axiosError.message || "Something went wrong.",
      "unknown_error",
      status,
      null,
    );
  }

  if (error instanceof Error) {
    return new ApiError(error.message, "unknown_error", null, null);
  }

  return new ApiError("Something went wrong.", "unknown_error", null, null);
}
