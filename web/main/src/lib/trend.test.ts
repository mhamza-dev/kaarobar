import { describe, expect, it } from "vitest";

import { changeBetween, formatChange, greeting } from "./trend";

describe("changeBetween", () => {
  it("is the fractional change from the previous period", () => {
    expect(changeBetween(120, 100)).toBeCloseTo(0.2);
    expect(changeBetween(75, 100)).toBeCloseTo(-0.25);
  });

  it("has nothing to say about a period after a zero", () => {
    expect(changeBetween(500, 0)).toBeNull();
    expect(changeBetween(Number.NaN, 10)).toBeNull();
  });
});

describe("formatChange", () => {
  it("signs whole percents with a true minus", () => {
    expect(formatChange(0.123)).toBe("+12%");
    expect(formatChange(-0.04)).toBe("−4%");
    expect(formatChange(0.001)).toBe("0%");
  });
});

describe("greeting", () => {
  it("reads the hour in the shop's timezone", () => {
    // 06:30 UTC is 11:30 in Karachi and 07:30 in Lisbon in October.
    const now = new Date("2026-10-24T06:30:00Z");
    expect(greeting("Asia/Karachi", now)).toBe("Good morning");
    expect(greeting("Asia/Tokyo", now)).toBe("Good afternoon");
    expect(greeting("America/Los_Angeles", now)).toBe("Good evening");
  });
});
