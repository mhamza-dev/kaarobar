import { describe, expect, it } from "vitest";

import {
  changeDue,
  fromMinor,
  isSettled,
  isValidPayment,
  remainingDue,
  suggestedAmount,
  toMinor,
} from "./tender";
import type { CheckoutPayment } from "@/types/api/sales";

const cash = (amount: string, tendered?: string): CheckoutPayment => ({
  method: "cash",
  amount,
  tendered_amount: tendered,
});
const card = (amount: string): CheckoutPayment => ({ method: "card", amount });

describe("minor-unit conversion", () => {
  it("round-trips a decimal string", () => {
    expect(fromMinor(toMinor("1850.00"))).toBe("1850.00");
    expect(fromMinor(toMinor("0.05"))).toBe("0.05");
  });

  it("avoids binary floating-point drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in float arithmetic.
    expect(toMinor("0.1") + toMinor("0.2")).toBe(toMinor("0.30"));
  });

  it("treats a blank or unparseable amount as zero rather than NaN", () => {
    expect(toMinor("")).toBe(0);
    expect(toMinor(null)).toBe(0);
    expect(toMinor("abc")).toBe(0);
  });
});

describe("remainingDue", () => {
  it("is the whole total when nothing is tendered", () => {
    expect(remainingDue("4320.00", [])).toBe(432000);
  });

  it("shrinks as tenders are added", () => {
    expect(remainingDue("4320.00", [cash("320.00")])).toBe(400000);
  });

  it("is zero once covered, never negative on an overpayment", () => {
    expect(remainingDue("100.00", [cash("100.00")])).toBe(0);
    expect(remainingDue("100.00", [cash("100.00", "500.00")])).toBe(0);
    expect(remainingDue("100.00", [cash("150.00")])).toBe(0);
  });

  it("adds up a split across several methods", () => {
    expect(remainingDue("1000.00", [cash("400.00"), card("600.00")])).toBe(0);
  });
});

describe("changeDue", () => {
  it("is what was handed over beyond what the cash tender settles", () => {
    expect(changeDue([cash("4320.00", "5000.00")])).toBe(68000);
  });

  it("is nothing when the exact amount is handed over", () => {
    expect(changeDue([cash("4320.00", "4320.00")])).toBe(0);
  });

  it("is nothing when no tendered amount was entered", () => {
    expect(changeDue([cash("4320.00")])).toBe(0);
  });

  it("ignores non-cash methods — there is nothing to hand back on a card", () => {
    expect(changeDue([{ method: "card", amount: "100.00", tendered_amount: "500.00" }])).toBe(0);
  });

  it("only counts the cash leg of a split payment", () => {
    expect(changeDue([card("600.00"), cash("400.00", "500.00")])).toBe(10000);
  });

  it("agrees with the backend on a real split tender", () => {
    // Cross-checked against a live checkout: a 3700.00 sale paid with
    // card 700.00 + cash 3000.00 tendered as 5000.00 returned
    // change_due "2000.00" from Kaarobar.Sales.Checkout. The backend's
    // figure is authoritative; this guards the one shown at the counter
    // from drifting away from it.
    expect(changeDue([card("700.00"), cash("3000.00", "5000.00")])).toBe(200000);
  });
});

describe("isSettled", () => {
  it("is false while anything is still owed", () => {
    expect(isSettled("100.00", [cash("99.99")])).toBe(false);
  });

  it("is true once the tenders cover the total", () => {
    expect(isSettled("100.00", [cash("100.00")])).toBe(true);
    expect(isSettled("100.00", [cash("60.00"), card("40.00")])).toBe(true);
  });

  it("is false for an empty basket, so a zero sale can't be rung up", () => {
    expect(isSettled("0.00", [])).toBe(false);
  });
});

describe("suggestedAmount", () => {
  it("offers the full total for the first tender", () => {
    expect(suggestedAmount("4320.00", [])).toBe("4320.00");
  });

  it("offers only the remainder once part is paid", () => {
    expect(suggestedAmount("1000.00", [card("600.00")])).toBe("400.00");
  });

  it("offers zero when the sale is already covered", () => {
    expect(suggestedAmount("1000.00", [card("1000.00")])).toBe("0.00");
  });
});

describe("isValidPayment", () => {
  it("rejects a zero or negative tender", () => {
    expect(isValidPayment(cash("0"))).toBe(false);
    expect(isValidPayment(cash("-5.00"))).toBe(false);
  });

  it("accepts cash tendered above its amount, which is just change", () => {
    expect(isValidPayment(cash("100.00", "500.00"))).toBe(true);
  });

  it("rejects cash tendered below what it claims to settle", () => {
    expect(isValidPayment(cash("100.00", "50.00"))).toBe(false);
  });

  it("accepts a card tender with no tendered amount", () => {
    expect(isValidPayment(card("100.00"))).toBe(true);
  });
});
