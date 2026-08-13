import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GradientMesh } from '@/components/ui/gradient-mesh';
import { makeStyles, useTheme } from '@/theme';

type Props = {
  children?: ReactNode;
  /** Wrap children in a ScrollView. Off for screens with their own FlatList. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Screen scaffold: ambient mesh background and consistent padding.
 *
 * Safe-area and tab-bar clearance are handled once by the tabs layout's
 * `sceneStyle`, so this component deliberately adds no insets of its own —
 * doing both double-pads every screen.
 */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  padded = true,
  contentStyle,
  style,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const inner: StyleProp<ViewStyle> = [padded && styles.padded, contentStyle];

  return (
    <View style={[styles.root, style]}>
      <GradientMesh />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.brandOn}
                colors={[theme.brand]}
                progressBackgroundColor={theme.card}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.bgPrimary,
  },
  flex: {
    flex: 1,
  },
  padded: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
}));
