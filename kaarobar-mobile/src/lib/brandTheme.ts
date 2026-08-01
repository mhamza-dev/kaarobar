/** Derive brand palette from business primary_color (mirrors web brand-theme). */

export const DEFAULT_BRAND = "#1D4ED8";

export type BrandPalette = {
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandLight: string;
  brandForeground: string;
};

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function parseHexColor(hex: string | null | undefined): [number, number, number] | null {
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
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  return null;
}

function mix(
  rgb: [number, number, number],
  toward: [number, number, number],
  t: number
): [number, number, number] {
  return [
    rgb[0] + (toward[0] - rgb[0]) * t,
    rgb[1] + (toward[1] - rgb[1]) * t,
    rgb[2] + (toward[2] - rgb[2]) * t,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
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

export function brandPaletteFromPrimary(hex: string | null | undefined): BrandPalette {
  const primary = normalizeBrandHex(hex) || DEFAULT_BRAND;
  const rgb = parseHexColor(primary)!;
  return {
    brand: primary,
    brandHover: toHex(...mix(rgb, [0, 0, 0], 0.14)),
    brandSoft: toHex(...mix(rgb, [255, 255, 255], 0.82)),
    brandLight: toHex(...mix(rgb, [255, 255, 255], 0.9)),
    brandForeground: relativeLuminance(rgb) > 0.55 ? "#0B1220" : "#FFFFFF",
  };
}
