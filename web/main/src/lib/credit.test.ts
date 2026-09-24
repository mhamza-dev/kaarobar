import { describe, expect, it } from "vitest";

import { AGEING_BUCKETS, ageingShares, availableCreditLabel } from "./credit";

describe("ageingShares", () => {
  it("returns every bucket in collections order with its share of the total", () => {
    const shares = ageingShares({
      current: "500.00",
      days_1_30: "250.00",
      days_31_60: "250.00",
      days_61_90: "0.00",
      days_over_90: null,
      total: "1000.00",
    });

    expect(shares.map((share) => share.key)).toEqual(AGEING_BUCKETS.map((bucket) => bucket.key));
    expect(shares[0].percent).toBe(50);
    expect(shares[1].percent).toBe(25);
    expect(shares[4]).toMatchObject({ amount: null, percent: 0 });
  });

  it("does not divide by zero when nothing is owed", () => {
    const shares = ageingShares({
      current: "0.00",
      days_1_30: "0.00",
      days_31_60: "0.00",
      days_61_90: "0.00",
      days_over_90: "0.00",
      total: "0.00",
    });

    expect(shares.every((share) => share.percent === 0)).toBe(true);
  });
});

describe("availableCreditLabel", () => {
  it("says cash only when the customer may not buy on account", () => {
    expect(availableCreditLabel({ credit_allowed: false, available_credit: "500.00" }, "PKR")).toBe(
      "Cash only",
    );
  });

  it("reads the serializer's unlimited sentinel rather than formatting it", () => {
    expect(
      availableCreditLabel({ credit_allowed: true, available_credit: "unlimited" }, "PKR"),
    ).toBe("No limit");
  });

  it("formats a capped amount as money", () => {
    expect(
      availableCreditLabel({ credit_allowed: true, available_credit: "1500.00" }, "PKR"),
    ).toContain("1,500");
  });
});
