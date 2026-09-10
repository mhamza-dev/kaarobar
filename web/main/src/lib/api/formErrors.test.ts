import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";
import { applyApiFieldErrors } from "./formErrors";

const values = { email: "", organizationName: "" };

describe("applyApiFieldErrors", () => {
  it("routes a matching field error onto the form", () => {
    const setErrors = vi.fn();
    const error = new ApiError("Invalid", "validation_failed", 422, {
      email: "has already been taken",
    });

    const result = applyApiFieldErrors({ error, values, setErrors });

    expect(setErrors).toHaveBeenCalledWith({ email: "has already been taken" });
    expect(result).toEqual({ handled: true, unmapped: [] });
  });

  it("renames a backend field to the form field that produced it", () => {
    const setErrors = vi.fn();
    const error = new ApiError("Invalid", "validation_failed", 422, {
      slug: "has already been taken",
    });

    applyApiFieldErrors({
      error,
      values,
      setErrors,
      mapping: { slug: "organizationName" },
    });

    expect(setErrors).toHaveBeenCalledWith({ organizationName: "has already been taken" });
  });

  it("reports errors with nowhere to land instead of swallowing them", () => {
    const setErrors = vi.fn();
    const error = new ApiError("Invalid", "validation_failed", 422, {
      business_type: "is not supported",
    });

    const result = applyApiFieldErrors({ error, values, setErrors });

    expect(setErrors).not.toHaveBeenCalled();
    expect(result.handled).toBe(false);
    expect(result.unmapped).toEqual(["business type: is not supported"]);
  });

  it("leaves non-field errors to the caller's toast", () => {
    const setErrors = vi.fn();
    const error = new ApiError("Too many requests", "rate_limited", 429, null);

    expect(applyApiFieldErrors({ error, values, setErrors })).toEqual({
      handled: false,
      unmapped: [],
    });
    expect(setErrors).not.toHaveBeenCalled();
  });
});
