import { describe, expect, it } from "vitest";

import { compactNumber, presetRange } from "./reportPeriod";

const today = new Date(2026, 8, 24); // 24 Sep 2026

describe("presetRange", () => {
  it("counts today as the first day of the range", () => {
    expect(presetRange("today", today)).toEqual({ from: "2026-09-24", to: "2026-09-24" });
    expect(presetRange("7d", today)).toEqual({ from: "2026-09-18", to: "2026-09-24" });
    expect(presetRange("30d", today)).toEqual({ from: "2026-08-26", to: "2026-09-24" });
  });

  it("starts 'this month' on the first", () => {
    expect(presetRange("month", today)).toEqual({ from: "2026-09-01", to: "2026-09-24" });
  });
});

describe("compactNumber", () => {
  it("abbreviates large axis values", () => {
    expect(compactNumber(12500)).toMatch(/12\.5\s?K/i);
    expect(compactNumber(900)).toBe("900");
  });
});
