import { describe, expect, it } from "vitest";

import { DEFAULT_BRAND_COLOR, deriveBrandPalette } from "./theme";

describe("deriveBrandPalette", () => {
  it("derives a distinct hover and active shade from the brand color", () => {
    const palette = deriveBrandPalette(DEFAULT_BRAND_COLOR);

    expect(palette.primary).toBe("#2d6df6");
    expect(palette.primaryHover).not.toBe(palette.primary);
    expect(palette.primaryActive).not.toBe(palette.primaryHover);
  });

  it("returns a light tint, not another shade of the brand color", () => {
    const { tint, primary } = deriveBrandPalette("#2d6df6");
    expect(tint).not.toBe(primary);
    // Mixed 14% toward white, so it should be much closer to white than the
    // brand color is — a naive darken() would fail this.
    expect(tint.toLowerCase()).toMatch(/^#[e-f]/i);
  });

  it("picks readable on-primary text for dark and light brands", () => {
    // A dark navy needs white text; a bright yellow needs dark text.
    expect(deriveBrandPalette("#1e3a5f").onPrimary).toBe("#ffffff");
    expect(deriveBrandPalette("#fde047").onPrimary).toBe("#0f172a");
  });

  it("emits plain hex, not the v3-era RGB channel triples", () => {
    // Tailwind v4 generates opacity modifiers from a plain color value via
    // color-mix(); writing "45 109 246" here (which desktop/local's v3 setup
    // needs) would break every `bg-brand-primary/20` in the app.
    const palette = deriveBrandPalette(DEFAULT_BRAND_COLOR);
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
