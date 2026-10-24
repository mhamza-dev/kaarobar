import { describe, expect, it } from "vitest";

import { initials, swatchFor } from "./initials";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Ayesha Siddiqui")).toBe("AS");
    expect(initials("green valley school")).toBe("GV");
  });

  it("skips words that are sizes or numbers", () => {
    expect(initials("Cashews 250g")).toBe("CA");
    expect(initials("7Up 1.5L")).toBe("7U");
  });
});

describe("swatchFor", () => {
  it("gives a name the same colour every time", () => {
    expect(swatchFor("Hotel Shalimar")).toBe(swatchFor("Hotel Shalimar"));
  });
});
