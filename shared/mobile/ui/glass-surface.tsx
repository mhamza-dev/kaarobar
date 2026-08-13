import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@shared/theme';

/**
 * Android blur is opt-in via `blurMethod`. `dimezisBlurViewSdk31Plus` uses the
 * native implementation on SDK 31+ and silently falls back to a translucent
 * view on older devices — which is what we want on the low-end hardware the POS
 * runs on, where the pre-31 path measurably drops frames.
 * See https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/
 */
const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

export type GlassIntensity = 'subtle' | 'card' | 'chrome' | 'modal';

type Props = {
  children?: ReactNode;
  intensity?: GlassIntensity;
  /** Heavier fill for surfaces that sit over busy content (sheets, tab bar). */
  strong?: boolean;
  bordered?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlassSurface({
  children,
  intensity = 'card',
  strong = false,
  bordered = true,
  radius,
  style,
}: Props) {
  const theme = useTheme();
  const cornerRadius = radius ?? theme.radius.xl;

  const shell: StyleProp<ViewStyle> = [
    {
      borderRadius: cornerRadius,
      overflow: 'hidden',
      borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.glassBorder,
    },
    style,
  ];

  const fill = strong ? theme.glassStrong : theme.glass;

  return (
    <BlurView
      intensity={theme.blur[intensity]}
      tint={theme.isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
      blurMethod={Platform.OS === 'android' ? ANDROID_BLUR_METHOD : undefined}
      style={shell}>
      {/* BlurView alone reads too transparent over the mesh background; the tint
          layer restores contrast for text sitting on the surface. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <GlassHighlight radius={cornerRadius} />
      {children}
    </BlurView>
  );
}

/** Top inner hairline that sells the "pane of glass" edge. */
function GlassHighlight({ radius }: { radius: number }) {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: radius * 0.5,
        right: radius * 0.5,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.glassHighlight,
      }}
    />
  );
}
