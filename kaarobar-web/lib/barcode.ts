/**
 * Kaarobar store barcode: `KB` + shop initials + random digits.
 * Example: Glow Studio Saloon → `KBGSS92152458393`
 * Suitable for POS scan lookup via GET /products/by-barcode/:code (Code128 / alphanumeric).
 */

const FILLER = new Set([
  "the",
  "and",
  "of",
  "a",
  "an",
  "for",
  "at",
  "by",
  "with",
  "in",
  "&",
]);

/** First Latin letter of each significant word, e.g. "Glow Studio Saloon" → "GSS". */
export function shopInitials(shopName?: string | null): string {
  const raw = (shopName || "").trim();
  if (!raw) return "SH";

  const words = raw
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .split(/[\s&'-]+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const significant = words.filter((w) => {
    const lower = w.toLowerCase();
    // Keep single-letter brand tokens (e.g. "A & B Mart" → ABM).
    if (w.length === 1 && /[A-Za-z]/.test(w)) return true;
    return !FILLER.has(lower);
  });
  const source = significant.length > 0 ? significant : words;

  const letters = source
    .map((w) => {
      const m = w.match(/[A-Za-z]/);
      return m ? m[0].toUpperCase() : null;
    })
    .filter((c): c is string => !!c);

  if (letters.length >= 2) {
    return letters.slice(0, 4).join("");
  }

  if (letters.length === 1) {
    const word = source[0].replace(/[^A-Za-z]/g, "").toUpperCase();
    return (word.slice(0, 3) || letters[0]).padEnd(2, "X").slice(0, 3);
  }

  return "SH";
}

export function generateBarcode(shopName?: string | null): string {
  const initials = shopInitials(shopName);
  const digits = Array.from({ length: 11 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
  return `KB${initials}${digits}`;
}
