import { darken, getLuminance, mix, toHex } from "color2k";

/**
 * Per-business brand color, derived and applied at runtime.
 *
 * Ported from desktop/local/src/lib/theme.ts — same algorithm, adapted for
 * Tailwind v4: tokens here are plain hex strings written straight onto the
 * CSS custom properties `@theme` reads (see src/app/globals.css), not the
 * space-separated RGB "channels" desktop/local's Tailwind v3 setup needs for
 * `rgb(var(--x) / <alpha-value>)` opacity support — v4 generates opacity
 * modifiers itself via `color-mix()` from a plain color value.
 */

export type BrandPalette = {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  tint: string;
  onPrimary: string;
};

export type BrandColorPreset = {
  id: string;
  hex: string;
  label: string;
};

/** Official Kaarobar brand blue — the default until a business picks one. */
export const DEFAULT_BRAND_COLOR = "#2d6df6";

/** Curated business brand colors — no free-form picker, matches desktop/local. */
export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { id: "kaarobar", hex: "#2d6df6", label: "Kaarobar blue" },
  { id: "navy", hex: "#1e3a5f", label: "Navy" },
  { id: "teal", hex: "#0f766e", label: "Teal" },
  { id: "forest", hex: "#166534", label: "Forest" },
  { id: "copper", hex: "#b45309", label: "Copper" },
  { id: "crimson", hex: "#be123c", label: "Crimson" },
  { id: "slate", hex: "#334155", label: "Slate" },
  { id: "indigo", hex: "#3730a3", label: "Indigo" },
];

/** Derives hover/active/tint/on-primary from a single brand hex. */
export function deriveBrandPalette(brandHex: string): BrandPalette {
  const primary = toHex(brandHex);
  const primaryHover = toHex(darken(primary, 0.1));
  const primaryActive = toHex(darken(primary, 0.15));
  // Mix toward white so saturated brand blues keep a visible soft tint.
  const tint = toHex(mix("#ffffff", primary, 0.14));
  // Light brands get dark text; dark brands get white text (buttons, badges).
  const onPrimary = getLuminance(primary) > 0.55 ? "#0f172a" : "#ffffff";

  return { primary, primaryHover, primaryActive, tint, onPrimary };
}

const BRAND_VAR_NAMES: Record<keyof BrandPalette, string> = {
  primary: "--brand-primary",
  primaryHover: "--brand-primary-hover",
  primaryActive: "--brand-primary-active",
  tint: "--brand-tint",
  onPrimary: "--brand-on-primary",
};

/** Applies a business's brand color to `:root` so every `brand-*`/`primary` utility updates live. */
export function applyBrandTheme(brandHex: string | null | undefined): BrandPalette {
  const palette = deriveBrandPalette(brandHex || DEFAULT_BRAND_COLOR);
  const root = document.documentElement;

  for (const key of Object.keys(BRAND_VAR_NAMES) as (keyof BrandPalette)[]) {
    root.style.setProperty(BRAND_VAR_NAMES[key], palette[key]);
  }

  return palette;
}

/** Resets `:root` back to the default Kaarobar brand (e.g. on logout). */
export function resetBrandTheme(): void {
  applyBrandTheme(DEFAULT_BRAND_COLOR);
}
