/** Derive UI brand tokens from a business `primary_color` hex. */

export const DEFAULT_BRAND = "#1D4ED8";

export type BrandTokens = {
  brand: string;
  brandHover: string;
  brandActive: string;
  brandForeground: string;
  brandSoft: string;
  brandLight: string;
  brandSubtle: string;
  brandMuted: string;
  brandGradient: string;
  brandGradientSoft: string;
  shadowBrand: string;
  railActive: string;
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

/** Expand #RGB / #RRGGBB to RGB 0–255. */
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

/** Build full token set from primary hex; falls back to Kaarobar sapphire. */
export function brandTokensFromPrimary(hex: string | null | undefined): BrandTokens {
  const primary = normalizeBrandHex(hex) || DEFAULT_BRAND;
  const rgb = parseHexColor(primary)!;
  const hover = toHex(...mix(rgb, [0, 0, 0], 0.14));
  const active = toHex(...mix(rgb, [0, 0, 0], 0.28));
  const soft = toHex(...mix(rgb, [255, 255, 255], 0.82));
  const light = toHex(...mix(rgb, [255, 255, 255], 0.9));
  const subtle = toHex(...mix(rgb, [255, 255, 255], 0.94));
  const muted = toHex(...mix(rgb, [255, 255, 255], 0.45));
  const lighter = toHex(...mix(rgb, [255, 255, 255], 0.22));
  const fg = relativeLuminance(rgb) > 0.55 ? "#0B1220" : "#FFFFFF";
  const [r, g, b] = rgb;

  return {
    brand: primary,
    brandHover: hover,
    brandActive: active,
    brandForeground: fg,
    brandSoft: soft,
    brandLight: light,
    brandSubtle: subtle,
    brandMuted: muted,
    brandGradient: `linear-gradient(135deg, ${lighter} 0%, ${primary} 52%, ${active} 100%)`,
    brandGradientSoft: `linear-gradient(135deg, rgba(${r},${g},${b},0.16) 0%, rgba(${r},${g},${b},0.08) 100%)`,
    shadowBrand: `0 12px 32px rgba(${r}, ${g}, ${b}, 0.28)`,
    railActive: soft,
  };
}

/** CSS custom properties for a BrandThemeScope / staff shell.
 *  Must set both `--brand*` and Tailwind `--color-brand*` — otherwise nested
 *  scopes do not remount utilities (root `--color-brand: var(--brand)` resolves at :root).
 */
export function brandCssVars(
  hex: string | null | undefined
): Record<string, string> | undefined {
  const normalized = normalizeBrandHex(hex);
  if (!normalized) return undefined;
  const t = brandTokensFromPrimary(normalized);
  return {
    "--brand": t.brand,
    "--brand-hover": t.brandHover,
    "--brand-active": t.brandActive,
    "--brand-foreground": t.brandForeground,
    "--brand-soft": t.brandSoft,
    "--brand-light": t.brandLight,
    "--brand-subtle": t.brandSubtle,
    "--brand-muted": t.brandMuted,
    "--brand-gradient": t.brandGradient,
    "--brand-gradient-soft": t.brandGradientSoft,
    "--shadow-brand": t.shadowBrand,
    "--border-focus": t.brand,
    "--link": t.brand,
    "--link-hover": t.brandHover,
    "--rail-active": t.railActive,
    // Tailwind v4 theme aliases (required for bg-brand / text-brand / etc.)
    "--color-brand": t.brand,
    "--color-brand-hover": t.brandHover,
    "--color-brand-active": t.brandActive,
    "--color-brand-foreground": t.brandForeground,
    "--color-brand-soft": t.brandSoft,
    "--color-brand-light": t.brandLight,
    "--color-brand-subtle": t.brandSubtle,
    "--color-brand-muted": t.brandMuted,
  };
}
