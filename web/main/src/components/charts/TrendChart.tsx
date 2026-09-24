"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltipBody } from "./ChartTooltip";

export type TrendPoint = {
  label: string;
  tick: string;
  /** Plot value only. */
  value: number;
  /** The exact figure, formatted from the backend's decimal string. */
  display: string;
  detail?: string;
};

/**
 * One series over time: a 2px line, a crosshair that snaps to the nearest
 * day, and a tooltip with the exact figure. Gridlines are solid hairlines
 * in the border token; the y-axis is abbreviated because the exact value is
 * one hover away.
 *
 * `value` is a number for plotting only — the tooltip shows `display`,
 * which the caller builds from the backend's decimal string.
 */
export function TrendChart({
  points,
  formatAxis,
  height = 240,
  ariaLabel,
}: {
  points: TrendPoint[];
  formatAxis: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={formatAxis}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TrendPoint | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltipBody value={point.display} label={point.label} detail={point.detail} />
              );
            }}
          />
          <Line
            // Straight segments: daily totals are points, and a smoothed curve
            // would draw sales between days that never happened.
            type="linear"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
