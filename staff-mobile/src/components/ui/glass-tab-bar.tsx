import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass-surface';
import { PressableScale } from '@/components/ui/pressable-scale';
import { makeStyles, useTheme } from '@/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Height of the bar itself, excluding safe-area inset. The tabs layout adds this
 * as bottom padding on every scene so content never hides behind the bar.
 */
export const TAB_BAR_CONTENT_HEIGHT = 58;

/** Route name -> icon pair (inactive, active). */
const ICONS: Record<string, [IoniconName, IoniconName]> = {
  pos: ['calculator-outline', 'calculator'],
  sales: ['receipt-outline', 'receipt'],
  products: ['cube-outline', 'cube'],
  customers: ['people-outline', 'people'],
  settings: ['settings-outline', 'settings'],
};

/** Floating blurred tab bar. Replaces the opaque bar from the RN CLI build. */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}
      pointerEvents="box-none">
      <GlassSurface
        intensity="chrome"
        strong
        radius={theme.radius.pill}
        style={[styles.bar, theme.elevation.lg]}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];

            // A custom tabBar renders `state.routes` itself, so expo-router's
            // `href: null` (which only swaps in an empty tabBarButton) would
            // otherwise still draw the tab. Filter it out explicitly.
            if ((options as { href?: string | null }).href === null) return null;

            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : (options.title ?? route.name);

            return (
              <TabItem
                key={route.key}
                name={route.name}
                label={label}
                focused={focused}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

function TabItem({
  name,
  label,
  focused,
  onPress,
}: {
  name: string;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const pill = useSharedValue(focused ? 1 : 0);

  // Drive from an effect: assigning during render is a side effect and the
  // React Compiler (on by default in SDK 57) rejects it.
  useEffect(() => {
    pill.set(withSpring(focused ? 1 : 0, theme.motion.springSoft));
  }, [focused, pill, theme.motion.springSoft]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.get(),
    transform: [{ scale: 0.85 + pill.get() * 0.15 }],
  }));

  const [inactive, active] = ICONS[name] ?? ['ellipse-outline', 'ellipse'];
  const tint = focused ? theme.brandOn : theme.muted;

  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.item}>
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: theme.brandAlpha(theme.isDark ? 0.22 : 0.12) },
          pillStyle,
        ]}
      />
      <Ionicons name={focused ? active : inactive} size={20} color={tint} />
      <Text numberOfLines={1} style={[styles.label, { color: tint }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: t.spacing.lg,
  },
  bar: {
    borderRadius: t.radius.pill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radius.pill,
  },
  pill: {
    ...StyleSheetAbsolute,
    borderRadius: t.radius.pill,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
}));

/** `StyleSheet.absoluteFillObject` inlined to keep the style factory pure. */
const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
