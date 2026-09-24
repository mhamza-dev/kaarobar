import { format, startOfMonth, subDays } from "date-fns";

import type { HourRow } from "@/types/api/reports";

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "month";

export const PERIOD_PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "month", label: "This month" },
];

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * A preset as the `from`/`to` dates the report endpoints take — both
 * inclusive, in the shop's calendar days (the backend turns them into
 * instants in the business's timezone). "7 days" means today and the six
 * before it, matching how the backend's own 30-day default is counted.
 */
export function presetRange(
  preset: PeriodPreset,
  today: Date = new Date(),
): {
  from: string;
  to: string;
} {
  const to = iso(today);
  switch (preset) {
    case "today":
      return { from: to, to };
    case "7d":
      return { from: iso(subDays(today, 6)), to };
    case "30d":
      return { from: iso(subDays(today, 29)), to };
    case "90d":
      return { from: iso(subDays(today, 89)), to };
    case "month":
      return { from: iso(startOfMonth(today)), to };
  }
}

/**
 * Axis labels: "12.5k", "1.2M". Presentation of a plot scale only — every
 * exact figure on screen comes from `formatMoney` on the backend's string.
 */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Every hour from the first trading hour to the last, zeros included — an
 * axis that skipped the quiet hours would draw a dead afternoon as if it
 * weren't there.
 */
export function fillHours(rows: HourRow[]): HourRow[] {
  if (rows.length === 0) return [];
  const byHour = new Map(rows.map((row) => [row.hour, row]));
  const first = Math.min(...rows.map((row) => row.hour));
  const last = Math.max(...rows.map((row) => row.hour));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const hour = first + index;
    return byHour.get(hour) ?? { hour, sale_count: 0, net_sales: "0.00" };
  });
}
