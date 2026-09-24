import { describe, expect, it } from "vitest";

import { canTransitionJob } from "./serviceJobs";

describe("canTransitionJob", () => {
  it("follows intake → in_progress → ready → delivered", () => {
    expect(canTransitionJob("intake", "start")).toBe(true);
    expect(canTransitionJob("in_progress", "ready")).toBe(true);
    expect(canTransitionJob("ready", "deliver")).toBe(true);
  });

  it("resumes a held job with start", () => {
    expect(canTransitionJob("on_hold", "start")).toBe(true);
  });

  it("offers nothing once the work has left the shop", () => {
    for (const transition of ["start", "ready", "deliver", "hold", "cancel"] as const) {
      expect(canTransitionJob("delivered", transition)).toBe(false);
      expect(canTransitionJob("cancelled", transition)).toBe(false);
    }
  });

  it("does not deliver work that isn't ready", () => {
    expect(canTransitionJob("in_progress", "deliver")).toBe(false);
  });
});
