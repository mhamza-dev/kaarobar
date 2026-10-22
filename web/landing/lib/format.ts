/**
 * "Rs 6,500" for a PKR price. Whole units: a subscription price with paisa
 * would be odd, and the API sends "6500.00".
 */
export function formatPrice(amount: string | null, currency: string): string {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(currency === "PKR" ? "en-PK" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en")}`;
  }
}

export function humanize(key: string): string {
  const words = key.replace(/^max_/, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
