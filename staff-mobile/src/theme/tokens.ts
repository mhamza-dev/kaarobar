/**
 * Kaarobar design tokens.
 *
 * Key names intentionally match the pre-Expo `colors` object so screens port
 * mechanically (`theme.heading` -> `theme.heading`), with glass/motion tokens
 * added on top. Keep in sync with `kaarobar-web/app/globals.css`.
 */

import { alpha, type BrandPalette, type ColorScheme } from '@/theme/palette';
import { useTheme } from '@/theme';

export type Elevation = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

type SurfaceTokens = {
  bgPrimary: string;
  bgSecondary: string;
  card: string;
  cardMuted: string;

  /** Translucent fill for blurred surfaces. */
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassHighlight: string;

  /** Ambient gradient-mesh blobs painted behind the app. */
  mesh1: string;
  mesh2: string;
  mesh3: string;

  border: string;
  borderStrong: string;
  divider: string;

  heading: string;
  body: string;
  muted: string;
  inverse: string;

  sidebar: string;
  sidebarMuted: string;

  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;

  accent: string;
  accentSoft: string;

  white: string;
  black: string;

  /** Skeleton / shimmer base and highlight. */
  skeleton: string;
  skeletonHighlight: string;

  /** Scrim behind modals and sheets. */
  scrim: string;
};

const light: SurfaceTokens = {
  bgPrimary: '#f6f8fb',
  bgSecondary: '#ffffff',
  card: '#ffffff',
  cardMuted: '#f8fafc',

  glass: 'rgba(255, 255, 255, 0.82)',
  glassStrong: 'rgba(255, 255, 255, 0.94)',
  glassBorder: 'rgba(148, 163, 184, 0.28)',
  glassHighlight: 'rgba(255, 255, 255, 0.65)',

  mesh1: 'rgba(59, 130, 246, 0.16)',
  mesh2: 'rgba(15, 118, 110, 0.10)',
  mesh3: 'rgba(129, 140, 248, 0.10)',

  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  divider: 'rgba(148, 163, 184, 0.22)',

  heading: '#0f172a',
  body: '#475569',
  muted: '#94a3b8',
  inverse: '#ffffff',

  sidebar: '#0b1220',
  sidebarMuted: '#94a3b8',

  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  info: '#0369a1',
  infoSoft: '#e0f2fe',

  accent: '#0f766e',
  accentSoft: '#ccfbf1',

  white: '#ffffff',
  black: '#000000',

  skeleton: 'rgba(148, 163, 184, 0.18)',
  skeletonHighlight: 'rgba(255, 255, 255, 0.55)',

  scrim: 'rgba(15, 23, 42, 0.42)',
};

const dark: SurfaceTokens = {
  bgPrimary: '#070b14',
  bgSecondary: '#0d1424',
  card: '#111a2e',
  cardMuted: '#0d1424',

  glass: 'rgba(17, 26, 46, 0.72)',
  glassStrong: 'rgba(17, 26, 46, 0.90)',
  glassBorder: 'rgba(148, 163, 184, 0.18)',
  glassHighlight: 'rgba(148, 197, 255, 0.10)',

  mesh1: 'rgba(59, 130, 246, 0.22)',
  mesh2: 'rgba(45, 212, 191, 0.14)',
  mesh3: 'rgba(129, 140, 248, 0.16)',

  border: '#1e293b',
  borderStrong: '#334155',
  divider: 'rgba(148, 163, 184, 0.16)',

  heading: '#f1f5f9',
  body: '#cbd5e1',
  muted: '#7c8aa0',
  inverse: '#0b1220',

  sidebar: '#060a12',
  sidebarMuted: '#7c8aa0',

  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',
  success: '#4ade80',
  successSoft: 'rgba(74, 222, 128, 0.16)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251, 191, 36, 0.16)',
  info: '#38bdf8',
  infoSoft: 'rgba(56, 189, 248, 0.16)',

  accent: '#2dd4bf',
  accentSoft: 'rgba(45, 212, 191, 0.16)',

  white: '#ffffff',
  black: '#000000',

  skeleton: 'rgba(148, 163, 184, 0.14)',
  skeletonHighlight: 'rgba(148, 197, 255, 0.10)',

  scrim: 'rgba(2, 6, 16, 0.62)',
};

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 18,
  '2xl': 24,
  pill: 999,
} as const;

/** 4pt spacing scale. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '600' },
  mono: { fontSize: 13, fontWeight: '600' },
} as const;

/**
 * Motion. Durations stay short because the POS is used one-handed at a counter —
 * anything above ~250ms reads as lag rather than polish.
 */
export const motion = {
  instant: 90,
  fast: 150,
  base: 200,
  slow: 260,
  /** Spring for press/scale feedback. */
  spring: { damping: 18, stiffness: 220, mass: 0.6 },
  /** Softer spring for entering surfaces. */
  springSoft: { damping: 22, stiffness: 140, mass: 0.9 },
  pressScale: 0.97,
} as const;

/** Blur intensity per surface role (expo-blur `intensity`). */
export const blur = {
  subtle: 12,
  card: 20,
  chrome: 32,
  modal: 44,
} as const;

function elevations(scheme: ColorScheme) {
  // Dark surfaces need opacity rather than spread to read as lifted.
  const shadowColor = scheme === 'dark' ? '#000000' : '#0f172a';
  const base = scheme === 'dark' ? 0.45 : 0.08;
  return {
    none: {
      shadowColor,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    } as Elevation,
    sm: {
      shadowColor,
      shadowOpacity: base,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    } as Elevation,
    md: {
      shadowColor,
      shadowOpacity: base + 0.04,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    } as Elevation,
    lg: {
      shadowColor,
      shadowOpacity: base + 0.08,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    } as Elevation,
  };
}

export type Theme = SurfaceTokens &
  BrandPalette & {
    scheme: ColorScheme;
    isDark: boolean;
    radius: typeof radius;
    spacing: typeof spacing;
    typography: typeof typography;
    motion: typeof motion;
    blur: typeof blur;
    elevation: ReturnType<typeof elevations>;
    /** Tint the brand at an arbitrary alpha (for glows / focus rings). */
    brandAlpha: (a: number) => string;
    /** @deprecated kept so ported screens compile; prefer `radius.lg`. */
    radiusLg: number;
  };

export function buildTheme(scheme: ColorScheme, brand: BrandPalette): Theme {
  const surfaces = scheme === 'dark' ? dark : light;
  return {
    ...surfaces,
    ...brand,
    scheme,
    isDark: scheme === 'dark',
    radius,
    spacing,
    typography,
    motion,
    blur,
    elevation: elevations(scheme),
    brandAlpha: (a: number) => alpha(brand.brand, a),
    radiusLg: radius.lg,
  };
}
