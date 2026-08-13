import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { Theme } from '@/theme/tokens';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build a theme-aware stylesheet hook.
 *
 * Replaces the module-level `StyleSheet.create({...})` used before dark mode —
 * styles now depend on the active theme, so they must be created inside render.
 * The result is memoised per theme object, so a re-render without a theme change
 * costs nothing.
 *
 * ```ts
 * const useStyles = makeStyles((t) => ({
 *   card: { backgroundColor: t.card, borderRadius: t.radius.xl },
 * }));
 *
 * function Panel() {
 *   const styles = useStyles();
 *   return <View style={styles.card} />;
 * }
 * ```
 */
export function makeStyles<T extends NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}

/** Same as `makeStyles` but hands the theme back too, for inline one-offs. */
export function makeThemedStyles<T extends NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useThemedStyles(): { styles: T; theme: Theme } {
    const theme = useTheme();
    const styles = useMemo(() => StyleSheet.create(factory(theme)), [theme]);
    return { styles, theme };
  };
}
