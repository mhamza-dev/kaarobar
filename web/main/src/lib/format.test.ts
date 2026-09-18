import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  formatSigned,
  isNegative,
} from "./format";

describe("formatMoney", () => {
  it("renders a decimal string in the given currency", () => {
    expect(formatMoney("1850.00", "PKR")).toContain("1,850");
  });

  it("shows a dash rather than NaN for a missing value", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
  });

  it("shows a dash for a value that isn't a number", () => {
    expect(formatMoney("not-a-price")).toBe("—");
  });

  it("keeps zero visible by default, since a zero balance is information", () => {
    expect(formatMoney("0.00")).not.toBe("—");
  });

  it("hides zero when the caller asks", () => {
    expect(formatMoney("0.00", "PKR", { showZero: false })).toBe("—");
  });

  it("does not lose precision on a long decimal string", () => {
    expect(formatMoney("1234567.89", "PKR")).toContain("1,234,567.89");
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros on a whole quantity", () => {
    expect(formatQuantity("40.000")).toBe("40");
  });

  it("keeps a genuinely fractional quantity", () => {
    expect(formatQuantity("1.250")).toBe("1.25");
  });

  it("renders zero as zero, not a dash", () => {
    expect(formatQuantity("0")).toBe("0");
  });

  it("dashes a missing quantity", () => {
    expect(formatQuantity(null)).toBe("—");
  });
});

describe("formatSigned", () => {
  it("marks a positive variance with a plus", () => {
    expect(formatSigned("5")).toBe("+5");
  });

  it("leaves the minus on a negative variance", () => {
    expect(formatSigned("-3")).toBe("-3");
  });

  it("does not sign zero", () => {
    expect(formatSigned("0")).toBe("0");
  });
});

describe("isNegative", () => {
  it("detects a shortfall", () => {
    expect(isNegative("-0.5")).toBe(true);
    expect(isNegative("0")).toBe(false);
    expect(isNegative("2")).toBe(false);
    expect(isNegative(null)).toBe(false);
  });
});

describe("date formatting", () => {
  it("formats an ISO date", () => {
    expect(formatDate("2026-09-18")).toBe("18 Sep 2026");
  });

  it("formats an ISO timestamp with its time", () => {
    expect(formatDateTime("2026-09-18T14:30:00Z")).toContain("18 Sep 2026");
  });

  it("dashes a null or unparseable date rather than printing Invalid Date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("nonsense")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
  });
});
