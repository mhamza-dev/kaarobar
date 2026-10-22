import { describe, expect, it } from "vitest";

import { compactNumber, presetRange, shopToday } from "./reportPeriod";

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

describe("shopToday", () => {
  it("is the shop's date, which can already be tomorrow", () => {
    // 21:30 UTC on the 22nd is 02:30 on the 23rd in Karachi (UTC+5).
    const now = new Date(Date.UTC(2026, 9, 22, 21, 30));
    expect(presetRange("today", shopToday("Asia/Karachi", now))).toEqual({
      from: "2026-10-23",
      to: "2026-10-23",
    });
  });

  it("falls back to the browser's date without a usable timezone", () => {
    const now = new Date(2026, 9, 22, 12);
    expect(shopToday(null, now)).toBe(now);
    expect(shopToday("Not/AZone", now)).toBe(now);
  });
});

describe("compactNumber", () => {
  it("abbreviates large axis values", () => {
    expect(compactNumber(12500)).toMatch(/12\.5\s?K/i);
    expect(compactNumber(900)).toBe("900");
  });
});
