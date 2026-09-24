"use client";

/**
 * The one tooltip body every chart uses: the value leads (strong, primary
 * ink), the label follows (muted). Rendered as React text, so category
 * names from the API are never interpreted as markup.
 */
export function ChartTooltipBody({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
      <p className="text-muted-foreground">{label}</p>
      {detail && <p className="text-muted-foreground">{detail}</p>}
    </div>
  );
}
