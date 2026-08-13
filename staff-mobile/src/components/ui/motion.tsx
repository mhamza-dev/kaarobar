import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { motion } from '@/theme';

type Props = {
  children?: ReactNode;
  /** Stagger index — each step delays entry by ~40ms. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Entrance animation for stacked content. Staggering by list index makes a
 * screen assemble rather than pop, without any per-item state.
 */
export function Reveal({ children, index = 0, style }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 8) * 40)
        .springify()
        .damping(motion.springSoft.damping)
        .stiffness(motion.springSoft.stiffness)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/** Cross-fade for content that swaps in place (tab panels, async states). */
export function FadeSwap({ children, style }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(motion.fast)}
      exiting={FadeOut.duration(motion.instant)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/** Animates layout changes (rows inserted/removed/reordered). */
export const SmoothLayout = LinearTransition.duration(motion.base);

export { Animated };
