import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fire a selection haptic on press. Off for high-frequency POS taps. */
  haptic?: boolean;
  /** Scale floor while pressed. */
  scaleTo?: number;
};

/**
 * Pressable with spring scale feedback. Runs on the UI thread via Reanimated so
 * it stays responsive while the JS thread is busy fetching.
 */
export function PressableScale({
  children,
  style,
  haptic = false,
  scaleTo,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const target = scaleTo ?? theme.motion.pressScale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(target, theme.motion.spring);
        if (haptic && Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => undefined);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, theme.motion.spring);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle, disabled ? { opacity: 0.5 } : null]}>
      {children}
    </AnimatedPressable>
  );
}
