import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { useBrandPalette } from "./BrandThemeContext";
import type { BrandPalette } from "./brandTheme";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build StyleSheet from a factory that receives the live brand palette.
 * Recreates styles when primary_color / palette changes.
 */
export function useBrandStyles<T extends NamedStyles<T>>(
  factory: (palette: BrandPalette) => T
): T {
  const palette = useBrandPalette();
  return useMemo(() => StyleSheet.create(factory(palette)) as T, [palette, factory]);
}

export function useBrandAccent() {
  return useBrandPalette();
}
