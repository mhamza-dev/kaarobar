import { ApiError } from "./errors";

/**
 * Routes a failed request's field errors onto the form that caused them.
 *
 * The backend keys `details` by *its own* field names (`slug`, `email`,
 * `business_type`), which don't always match the form's field names — a
 * registration form's "Company name" input produces a `slug` error, for
 * instance. `mapping` renames those; anything with no mapping and no
 * matching form field is returned in `unmapped` so the caller can surface
 * it (a toast) rather than silently swallowing a message the user needs.
 */
export function applyApiFieldErrors<Values extends object>({
  error,
  values,
  setErrors,
  mapping = {},
}: {
  error: unknown;
  values: Values;
  setErrors: (errors: Record<string, string>) => void;
  mapping?: Record<string, keyof Values & string>;
}): { handled: boolean; unmapped: string[] } {
  if (!(error instanceof ApiError) || !error.fieldErrors) {
    return { handled: false, unmapped: [] };
  }

  const formErrors: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const [apiField, message] of Object.entries(error.fieldErrors)) {
    const formField = mapping[apiField] ?? apiField;

    if (formField in values) {
      formErrors[formField] = message;
    } else {
      unmapped.push(`${apiField.replace(/_/g, " ")}: ${message}`);
    }
  }

  if (Object.keys(formErrors).length > 0) setErrors(formErrors);

  return { handled: Object.keys(formErrors).length > 0, unmapped };
}
