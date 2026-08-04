import { formatDecimal } from "@/lib/decimal";

export type AllowanceRow = { name: string; amount: string };

/** Default rows for a new employee form. */
export function defaultAllowanceRows(): AllowanceRow[] {
  return [
    { name: "transport", amount: "3000" },
    { name: "meal", amount: "2000" },
  ];
}

/** Map API `allowances` object → editable rows. */
export function allowancesToRows(
  map?: Record<string, string | number> | null
): AllowanceRow[] {
  if (!map || Object.keys(map).length === 0) return defaultAllowanceRows();
  return Object.entries(map).map(([name, amount]) => ({
    name,
    amount: formatDecimal(String(amount ?? "0")),
  }));
}

/** Rows → API `allowances` map (keys lowercased / snake_case). */
export function rowsToAllowances(rows: AllowanceRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!key) continue;
    const amount = row.amount.trim();
    out[key] = amount === "" ? "0" : formatDecimal(amount);
  }
  return out;
}

/** Human label for an allowance key (`meal` → `Meal`, `house_rent` → `House rent`). */
export function formatAllowanceLabel(key: string): string {
  const cleaned = key.trim().replace(/_/g, " ");
  if (!cleaned) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function sumAllowances(
  map?: Record<string, string | number> | null
): number {
  if (!map) return 0;
  return Object.values(map).reduce<number>((acc, v) => {
    const n = Number(String(v).replace(/,/g, ""));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}
