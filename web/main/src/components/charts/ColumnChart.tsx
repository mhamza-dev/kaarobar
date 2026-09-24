"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBody } from "./ChartTooltip";

export type Column = {
  key: string;
  tick: string;
  label: string;
  /** Plot value only; `display` is the exact figure a person reads. */
  value: number;
  display: string;
  detail?: string;
};

/**
 * Vertical bars for a small, ordered set (hours of the day). Bars are
 * capped at 24px and rounded only at their data end; each bar is its own
 * hover target — no crosshair on bars.
 */
export function ColumnChart({
  columns,
  formatAxis,
  height = 220,
  ariaLabel,
}: {
  columns: Column[];
  formatAxis: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={columns} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={formatAxis}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={({ active, payload }) => {
              const column = payload?.[0]?.payload as Column | undefined;
              if (!active || !column) return null;
              return (
                <ChartTooltipBody
                  value={column.display}
                  label={column.label}
                  detail={column.detail}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-1)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
