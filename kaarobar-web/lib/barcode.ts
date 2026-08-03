/**
 * Generate a store-use EAN-13 barcode (prefix 200 = in-store / internal).
 * Suitable for POS scan lookup via GET /products/by-barcode/:code.
 */
export function generateBarcode(): string {
  const body = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
  const twelve = `200${body}`;
  return twelve + ean13CheckDigit(twelve);
}

function ean13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}
