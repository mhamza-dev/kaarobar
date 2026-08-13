/**
 * Derive a brand palette from the business `primary_color` (mirrors the web
 * brand-theme). Unlike the pre-Expo version this is *scheme aware*: soft/light
 * brand tints mix toward the surface colour of the active scheme, so a business
 * brand stays legible in dark mode instead of washing out to near-white.
 */

export const DEFAULT_BRAND = '#1D4ED8';

export type ColorScheme = 'light' | 'dark';

export type BrandPalette = {
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandLight: string;
  brandForeground: string;
  /** Brand tuned for text/icons on the scheme background (AA contrast). */
  brandOn: string;
};

type Rgb = [number, number, number];

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function parseHexColor(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const h = hex.trim();
  const m3 = /^#([0-9A-Fa-f]{3})$/.exec(h);
  if (m3) {
    const s = m3[1];
    return [
      parseInt(s[0] + s[0], 16),
      parseInt(s[1] + s[1], 16),
      parseInt(s[2] + s[2], 16),
    ];
  }
  const m6 = /^#([0-9A-Fa-f]{6})$/.exec(h);
  if (m6) {
    const s = m6[1];
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  }
  return null;
}

function mix(rgb: Rgb, toward: Rgb, t: number): Rgb {
  return [
    rgb[0] + (toward[0] - rgb[0]) * t,
    rgb[1] + (toward[1] - rgb[1]) * t,
    rgb[2] + (toward[2] - rgb[2]) * t,
  ];
}

function relativeLuminance([r, g, b]: Rgb) {
  const lin = [r, g, b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function normalizeBrandHex(hex: string | null | undefined): string | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return toHex(rgb[0], rgb[1], rgb[2]);
}

/** Convert a hex colour to `rgba()` at the given alpha. */
export function alpha(hex: string, a: number): string {
  const rgb = parseHexColor(hex) ?? [0, 0, 0];
  return `rgba(${clamp(rgb[0])}, ${clamp(rgb[1])}, ${clamp(rgb[2])}, ${a})`;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
/** Dark-scheme surface the brand tints are mixed into. */
const DARK_SURFACE: Rgb = [15, 23, 42];

export function brandPaletteFromPrimary(
  hex: string | null | undefined,
  scheme: ColorScheme = 'light',
): BrandPalette {
  const primary = normalizeBrandHex(hex) || DEFAULT_BRAND;
  const rgb = parseHexColor(primary)!;
  const luminance = relativeLuminance(rgb);
  const isDark = scheme === 'dark';

  // In dark mode a saturated mid-blue on near-black is hard to read, so lift the
  // brand toward white for text/icon use while keeping the true brand for fills.
  const brandOn = isDark && luminance < 0.3 ? toHex(...mix(rgb, WHITE, 0.42)) : primary;

  return {
    brand: primary,
    brandHover: isDark
      ? toHex(...mix(rgb, WHITE, 0.16))
      : toHex(...mix(rgb, BLACK, 0.14)),
    brandSoft: isDark
      ? toHex(...mix(rgb, DARK_SURFACE, 0.72))
      : toHex(...mix(rgb, WHITE, 0.82)),
    brandLight: isDark
      ? toHex(...mix(rgb, DARK_SURFACE, 0.85))
      : toHex(...mix(rgb, WHITE, 0.9)),
    brandForeground: luminance > 0.55 ? '#0B1220' : '#FFFFFF',
    brandOn,
  };
}
