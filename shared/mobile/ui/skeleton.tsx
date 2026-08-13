import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@shared/theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block. One shared loop per instance, UI-thread driven. */
export function Skeleton({ width = '100%', height = 14, radius, style }: Props) {
  const theme = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.set(withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    ));
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Several skeleton lines, for list/detail loading states. */
export function SkeletonLines({ count = 3, gap }: { count?: number; gap?: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: gap ?? theme.spacing.sm }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={i === count - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}
