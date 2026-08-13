/** Format money / measured amounts to exactly two decimal places. */
export function formatDecimal(
  value: string | number | null | undefined
): string {
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

/** Alias for money displays (prefix currency at the call site). */
export function formatMoney(
  value: string | number | null | undefined
): string {
  return formatDecimal(value);
}
