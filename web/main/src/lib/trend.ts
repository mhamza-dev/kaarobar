/**
 * Change between two periods, as a fraction (0.12 for +12%).
 *
 * `null` when there's nothing to compare against — a first day of trading
 * isn't "+∞%", it's simply new. Plot-scale arithmetic on presentation
 * numbers only; the figures themselves stay the backend's strings.
 */
export function changeBetween(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** "+12%", "−4%", "0%" — whole percents, with a true minus sign. */
export function formatChange(change: number): string {
  const percent = Math.round(change * 100);
  if (percent === 0) return "0%";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}

/**
 * "Good morning" by the shop's clock rather than the browser's, for the
 * same reason the reports use the shop's today.
 */
export function greeting(timeZone?: string | null, now: Date = new Date()): string {
  let hour = now.getHours();
  if (timeZone) {
    try {
      hour = Number(
        new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(
          now,
        ),
      );
    } catch {
      // Unknown zone — the browser's hour will do.
    }
  }
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
