import { describe, expect, it } from "vitest";

import { canMarkNoShow, isLiveAppointment, nextAppointmentStep } from "./appointments";

describe("nextAppointmentStep", () => {
  it("walks booked → confirm → arrive → start → complete", () => {
    expect(nextAppointmentStep("booked")?.step).toBe("confirm");
    expect(nextAppointmentStep("confirmed")?.step).toBe("arrive");
    expect(nextAppointmentStep("arrived")?.step).toBe("start");
    expect(nextAppointmentStep("in_progress")?.step).toBe("complete");
  });

  it("offers nothing once the booking is over", () => {
    for (const status of ["completed", "cancelled", "no_show"]) {
      expect(nextAppointmentStep(status)).toBeNull();
    }
  });
});

describe("isLiveAppointment / canMarkNoShow", () => {
  it("treats only slot-holding statuses as live", () => {
    expect(isLiveAppointment("arrived")).toBe(true);
    expect(isLiveAppointment("completed")).toBe(false);
  });

  it("allows a no-show only before arrival", () => {
    expect(canMarkNoShow("confirmed")).toBe(true);
    expect(canMarkNoShow("arrived")).toBe(false);
  });
});
