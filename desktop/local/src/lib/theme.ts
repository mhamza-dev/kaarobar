import { darken, getLuminance, mix, parseToRgba, toHex } from 'color2k'

/** Convert a hex color to space-separated RGB channels for Tailwind opacity support. */
export function hexToRgbChannels(hex: string): string {
  const [r, g, b] = parseToRgba(hex)
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`
}

export type BrandPalette = {
  primary: string
  primaryHover: string
  primaryActive: string
  tint: string
  onPrimary: string
}

export type BrandColorPreset = {
  id: string
  hex: string
  labelKey: string
}

/** Official Kaarobar brand blue from the logo mark. */
export const DEFAULT_BRAND_COLOR = '#2d6df6'

/** Curated shop brand colors — no free-form picker. */
export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { id: 'kaarobar', hex: '#2d6df6', labelKey: 'brandColors.kaarobar' },
  { id: 'navy', hex: '#1e3a5f', labelKey: 'brandColors.navy' },
  { id: 'teal', hex: '#0f766e', labelKey: 'brandColors.teal' },
  { id: 'forest', hex: '#166534', labelKey: 'brandColors.forest' },
  { id: 'copper', hex: '#b45309', labelKey: 'brandColors.copper' },
  { id: 'crimson', hex: '#be123c', labelKey: 'brandColors.crimson' },
  { id: 'slate', hex: '#334155', labelKey: 'brandColors.slate' },
  { id: 'indigo', hex: '#3730a3', labelKey: 'brandColors.indigo' },
]

/** Derive hover/active/tint/on-primary from a single brand hex. */
export function deriveBrandPalette(brandHex: string): BrandPalette {
  const primary = toHex(brandHex)
  const primaryHover = toHex(darken(primary, 0.1))
  const primaryActive = toHex(darken(primary, 0.15))
  // Mix toward white so saturated brand blues keep a visible soft tint.
  const tint = toHex(mix('#ffffff', primary, 0.14))
  // Light brands get dark text; dark brands get white text (buttons, badges).
  const onPrimary = getLuminance(primary) > 0.55 ? '#0f172a' : '#ffffff'

  return { primary, primaryHover, primaryActive, tint, onPrimary }
}

/** Apply brand CSS variables on :root so Tailwind `brand-*` classes update live. */
export function applyBrandTheme(brandHex: string): BrandPalette {
  const palette = deriveBrandPalette(brandHex)
  const root = document.documentElement

  root.style.setProperty('--brand-primary', hexToRgbChannels(palette.primary))
  root.style.setProperty('--brand-primary-hover', hexToRgbChannels(palette.primaryHover))
  root.style.setProperty('--brand-primary-active', hexToRgbChannels(palette.primaryActive))
  root.style.setProperty('--brand-tint', hexToRgbChannels(palette.tint))
  root.style.setProperty('--brand-on-primary', hexToRgbChannels(palette.onPrimary))

  return palette
}

/** Snap unknown saved colors to the nearest preset (or keep if already a preset). */
export function resolveBrandPresetHex(hex: string | null | undefined): string {
  const normalized = (hex ?? DEFAULT_BRAND_COLOR).trim().toLowerCase()
  const exact = BRAND_COLOR_PRESETS.find((p) => p.hex.toLowerCase() === normalized)
  if (exact) return exact.hex
  return DEFAULT_BRAND_COLOR
}
