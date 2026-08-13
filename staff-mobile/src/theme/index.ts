/**
 * App-facing theme barrel: everything shared, plus this app's provider.
 * Screens import from `@/theme` and never need to know which half is shared.
 */
export {
  alpha,
  brandPaletteFromPrimary,
  buildTheme,
  DEFAULT_BRAND,
  makeStyles,
  makeThemedStyles,
  normalizeBrandHex,
  parseHexColor,
  blur,
  motion,
  radius,
  spacing,
  typography,
  useTheme,
  type BrandPalette,
  type ColorScheme,
  type Theme,
} from '@shared/theme';

export {
  ThemeProvider,
  useThemeControls,
  type SchemePreference,
} from '@/theme/theme-provider';

/** Brand-only accessor, mirroring the pre-Expo `useBrandPalette()`. */
export { useTheme as useBrandPalette } from '@shared/theme';
