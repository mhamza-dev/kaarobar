import { createContext, use, type ReactNode } from 'react';

import { brandPaletteFromPrimary } from '@core/lib/brand-palette';
import { buildTheme, type Theme } from '@shared/theme/tokens';

/**
 * Holds the resolved theme only.
 *
 * Deliberately dumb: computing the theme needs the signed-in business's brand
 * colour, which comes from each app's own API client. So the app owns the
 * provider that *derives* the theme, and this shared context just carries the
 * result — that way shared components can call `useTheme()` without any app
 * dependency.
 */
const ThemeContext = createContext<Theme | null>(null);

export function ThemeValueProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** The active theme. Falls back to the light default outside a provider. */
export function useTheme(): Theme {
  return use(ThemeContext) ?? buildTheme('light', brandPaletteFromPrimary(null, 'light'));
}
