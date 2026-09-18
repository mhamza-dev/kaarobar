import { describe, expect, it } from "vitest";

import { addLine, itemCount, removeLine, setQuantity, toCheckoutLines } from "./cart";
import type { CartLine } from "./cart";

const rice = { variantId: "v1", name: "Basmati rice 5kg", unitPrice: "1850.00" };
const oil = { variantId: "v2", name: "Cooking oil 1L", unitPrice: "620.00" };

describe("addLine", () => {
  it("appends a product that isn't in the cart yet", () => {
    const lines = addLine([], rice);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1);
  });

  it("increments instead of appending a duplicate line", () => {
    // Scanning the same barcode three times is one line of three, not three
    // lines of one — two identical lines is how a till double-charges.
    const lines = addLine(addLine(addLine([], rice), rice), rice);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("keeps distinct products on separate lines", () => {
    const lines = addLine(addLine([], rice), oil);
    expect(lines.map((line) => line.variantId)).toEqual(["v1", "v2"]);
  });

  it("adds a given quantity in one go", () => {
    expect(addLine([], rice, 5)[0].quantity).toBe(5);
  });

  it("does not mutate the array it was given", () => {
    const original: CartLine[] = [{ ...rice, quantity: 1 }];
    addLine(original, oil);
    expect(original).toHaveLength(1);
  });
});

describe("setQuantity", () => {
  it("sets an explicit quantity", () => {
    const lines = setQuantity([{ ...rice, quantity: 1 }], "v1", 4);
    expect(lines[0].quantity).toBe(4);
  });

  it("removes the line at zero, rather than keeping a zero-quantity row", () => {
    expect(setQuantity([{ ...rice, quantity: 2 }], "v1", 0)).toEqual([]);
  });

  it("removes the line on a negative quantity too", () => {
    expect(setQuantity([{ ...rice, quantity: 2 }], "v1", -1)).toEqual([]);
  });

  it("leaves other lines alone", () => {
    const lines = setQuantity(
      [
        { ...rice, quantity: 1 },
        { ...oil, quantity: 2 },
      ],
      "v1",
      9,
    );
    expect(lines.find((line) => line.variantId === "v2")?.quantity).toBe(2);
  });
});

describe("removeLine", () => {
  it("drops just the named line", () => {
    const lines = removeLine(
      [
        { ...rice, quantity: 1 },
        { ...oil, quantity: 1 },
      ],
      "v1",
    );
    expect(lines.map((line) => line.variantId)).toEqual(["v2"]);
  });
});

describe("itemCount", () => {
  it("counts units, not lines", () => {
    expect(
      itemCount([
        { ...rice, quantity: 3 },
        { ...oil, quantity: 2 },
      ]),
    ).toBe(5);
  });

  it("is zero for an empty cart", () => {
    expect(itemCount([])).toBe(0);
  });
});

describe("toCheckoutLines", () => {
  it("sends identity and quantity only — never a price", () => {
    const [line] = toCheckoutLines([{ ...rice, quantity: 2 }]);

    expect(line).toEqual({ variant_id: "v1", quantity: "2", note: undefined });
    expect(line).not.toHaveProperty("unit_price");
    expect(line).not.toHaveProperty("name");
  });

  it("stringifies quantities, matching the decimal-string wire format", () => {
    expect(toCheckoutLines([{ ...rice, quantity: 3 }])[0].quantity).toBe("3");
  });
});
