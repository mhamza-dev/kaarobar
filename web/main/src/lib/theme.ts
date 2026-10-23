import { darken, getContrast, getLuminance, mix, toHex } from "color2k";

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

/** The dark-mode card surface (`.dark --card` in globals.css). */
export const DARK_SURFACE = "#141a2a";
/** Dark ink for text on a light primary in dark mode. */
const DARK_INK = "#0a1020";

/**
 * The same brand for dark mode. A navy or forest brand all but vanishes on
 * a dark surface, so the primary is lifted toward white until it reads as
 * text there (>= 4.5:1), and the tint is the brand mixed into that surface
 * rather than into white — a light tint behind white text is unreadable.
 */
export function deriveDarkBrandPalette(brandHex: string): BrandPalette {
  const base = toHex(brandHex);
  let primary = base;
  for (let step = 1; step <= 20 && getContrast(primary, DARK_SURFACE) < 4.5; step += 1) {
    primary = toHex(mix(base, "#ffffff", step * 0.05));
  }
  const primaryHover = toHex(mix(primary, "#ffffff", 0.12));
  const primaryActive = toHex(mix(primary, "#ffffff", 0.25));
  const tint = toHex(mix(DARK_SURFACE, primary, 0.22));
  // Whichever ink reads better on the lifted primary.
  const onPrimary =
    getContrast(primary, "#ffffff") >= getContrast(primary, DARK_INK) ? "#ffffff" : DARK_INK;

  return { primary, primaryHover, primaryActive, tint, onPrimary };
}

const BRAND_VAR_SUFFIXES: Record<keyof BrandPalette, string> = {
  primary: "primary",
  primaryHover: "primary-hover",
  primaryActive: "primary-active",
  tint: "tint",
  onPrimary: "on-primary",
};

/**
 * Applies a business's brand color to `:root` so every `brand-*`/`primary`
 * utility updates live. Both palettes are written — `--brand-light-*` and
 * `--brand-dark-*` — and globals.css maps `--brand-*` to the one for the
 * current mode, so switching light/dark needs nothing from here.
 */
export function applyBrandTheme(brandHex: string | null | undefined): BrandPalette {
  const hex = brandHex || DEFAULT_BRAND_COLOR;
  const palettes = { light: deriveBrandPalette(hex), dark: deriveDarkBrandPalette(hex) };
  const root = document.documentElement;

  for (const [mode, palette] of Object.entries(palettes)) {
    for (const key of Object.keys(BRAND_VAR_SUFFIXES) as (keyof BrandPalette)[]) {
      root.style.setProperty(`--brand-${mode}-${BRAND_VAR_SUFFIXES[key]}`, palette[key]);
    }
  }

  return palettes.light;
}

/** Resets `:root` back to the default Kaarobar brand (e.g. on logout). */
export function resetBrandTheme(): void {
  applyBrandTheme(DEFAULT_BRAND_COLOR);
}
