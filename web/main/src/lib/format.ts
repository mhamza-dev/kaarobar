import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/**
 * Formatters for the string-encoded numbers the backend sends.
 *
 * Money and quantities arrive as **strings** on purpose (`JSONHelpers`: a
 * price that reaches a browser as an IEEE-754 double has already lost the
 * argument). These helpers are the only place that turns one into something
 * a person reads — and they never do arithmetic, only presentation, so the
 * decimal string stays authoritative right up to the moment it is displayed.
 */

/** Renders a money string in the business's currency. */
export function formatMoney(
  value: string | null | undefined,
  currency = "PKR",
  options: { showZero?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";

  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  if (amount === 0 && options.showZero === false) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    // Two decimals is right for the currencies in play; a zero-decimal
    // currency would render "PKR 1,850.00" as "¥1,850" on its own.
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

/**
 * Renders a quantity string, keeping whatever precision it carried.
 *
 * Trailing zeros are dropped so "40.000" reads as "40", but a genuinely
 * fractional quantity ("1.250" kg of mince) keeps its decimals.
 */
export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";

  const quantity = Number(value);
  if (Number.isNaN(quantity)) return "—";

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(quantity);
}

/** True when a decimal string is negative — for tinting a variance red. */
export function isNegative(value: string | null | undefined): boolean {
  if (!value) return false;
  const amount = Number(value);
  return !Number.isNaN(amount) && amount < 0;
}

/** A signed quantity, so a stock variance shows its direction. */
export function formatSigned(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const quantity = Number(value);
  if (Number.isNaN(quantity)) return "—";
  return quantity > 0 ? `+${formatQuantity(value)}` : formatQuantity(value);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** A date, for anything a person reads in a table. */
export function formatDate(value: string | null | undefined): string {
  const parsed = toDate(value);
  return parsed ? format(parsed, "d MMM yyyy") : "—";
}

/** Date plus time, for timestamps where the hour matters (a stock move). */
export function formatDateTime(value: string | null | undefined): string {
  const parsed = toDate(value);
  return parsed ? format(parsed, "d MMM yyyy, HH:mm") : "—";
}

/** "3 days ago" — for recency, where the exact timestamp is noise. */
export function formatRelative(value: string | null | undefined): string {
  const parsed = toDate(value);
  return parsed ? `${formatDistanceToNowStrict(parsed)} ago` : "—";
}

/** Turns a backend enum like `goods_received` into `Goods received`. */
export function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Percentages travel as fractions (`0.05`) — a customer group's
 * `discount_percent` and the loyalty programme's `max_redeem_percent` are
 * both validated 0–1 by the backend. People think in percent, so forms edit
 * `5` and these two convert at the boundary — string in, string out, so the
 * decimal never becomes a float on its way to the backend.
 */
export function fractionToPercent(value: string | null): string {
  if (value === null || value === "") return "";
  const percent = Number(value) * 100;
  return Number.isFinite(percent) ? String(Number(percent.toFixed(4))) : "";
}

export function percentToFraction(value: string | number): string | null {
  if (value === "" || value === null) return null;
  const fraction = Number(value) / 100;
  return Number.isFinite(fraction) ? String(Number(fraction.toFixed(6))) : null;
}

/** Today as the `yyyy-MM-dd` string date fields and the API use. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
