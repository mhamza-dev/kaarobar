import type { AppointmentStep } from "@/types/api/scheduling";

/**
 * The next step of a booking, from its status — the one `advance` step the
 * backend accepts from there (`Scheduling.advance/3`: booked → confirmed →
 * arrived → in_progress → completed). Terminal states have none.
 */
export function nextAppointmentStep(
  status: string,
): { step: AppointmentStep; label: string } | null {
  switch (status) {
    case "booked":
      return { step: "confirm", label: "Confirm" };
    case "confirmed":
      return { step: "arrive", label: "Arrived" };
    case "arrived":
      return { step: "start", label: "Start" };
    case "in_progress":
      return { step: "complete", label: "Complete" };
    default:
      return null;
  }
}

/** Still holding the slot — `Appointment` @live_statuses. */
export function isLiveAppointment(status: string): boolean {
  return ["booked", "confirmed", "arrived", "in_progress"].includes(status);
}

/** A no-show only makes sense before the customer has turned up. */
export function canMarkNoShow(status: string): boolean {
  return status === "booked" || status === "confirmed";
}
