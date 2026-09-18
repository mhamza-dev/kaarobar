import type { CheckoutLine } from "@/types/api/sales";

/**
 * The cart's contents — quantities and identity only.
 *
 * `name` and `unitPrice` are carried purely so a scanned line can be shown
 * before the quote comes back; they are display hints, never inputs to the
 * sale. What is actually sent to the backend is `toCheckoutLines`, which
 * emits variant ids and quantities and nothing else.
 */
export type CartLine = {
  variantId: string;
  name: string;
  /** Last known catalog price, for the optimistic row before re-quoting. */
  unitPrice: string | null;
  quantity: number;
  note?: string;
};

/**
 * Adds a scanned or tapped product.
 *
 * Scanning the same barcode twice increments rather than appending — a
 * cashier scanning three tins expects one line of three, and two identical
 * lines is how a counter ends up double-charging without noticing.
 */
export function addLine(
  lines: CartLine[],
  line: Omit<CartLine, "quantity">,
  quantity = 1,
): CartLine[] {
  const existing = lines.findIndex((candidate) => candidate.variantId === line.variantId);
  if (existing === -1) return [...lines, { ...line, quantity }];

  return lines.map((candidate, index) =>
    index === existing ? { ...candidate, quantity: candidate.quantity + quantity } : candidate,
  );
}

/** Sets an explicit quantity; anything at or below zero removes the line. */
export function setQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, variantId);
  return lines.map((line) => (line.variantId === variantId ? { ...line, quantity } : line));
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((line) => line.variantId !== variantId);
}

/** Total item count, for the "12 items" badge. */
export function itemCount(lines: CartLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

/**
 * What actually goes to `/sales/quote` and `/sales`: identity and quantity.
 * No prices — the backend prices the basket.
 */
export function toCheckoutLines(lines: CartLine[]): CheckoutLine[] {
  return lines.map((line) => ({
    variant_id: line.variantId,
    quantity: String(line.quantity),
    note: line.note,
  }));
}
