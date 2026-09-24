/**
 * Which service-job transitions to offer, from the job's status.
 *
 * `ServiceDesk` applies its changesets without checking where a job came
 * from, so this is the one place that keeps the counter from, say,
 * "starting" a job that was already handed back. The flow is intake →
 * in_progress → ready → delivered, with on_hold as a pause from either of
 * the first two and cancel available until the work leaves the shop.
 */
export type JobTransition = "start" | "ready" | "deliver" | "hold" | "cancel";

const ALLOWED: Record<JobTransition, readonly string[]> = {
  start: ["intake", "on_hold"],
  ready: ["intake", "in_progress"],
  deliver: ["ready"],
  hold: ["intake", "in_progress"],
  cancel: ["intake", "in_progress", "on_hold", "ready"],
};

export function canTransitionJob(status: string, transition: JobTransition): boolean {
  return ALLOWED[transition].includes(status);
}
