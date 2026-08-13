import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientMesh } from '@/components/ui/gradient-mesh';
import { makeStyles, useTheme } from '@/theme';

/** Extra bottom padding so content clears the floating glass tab bar. */
export const TAB_BAR_CLEARANCE = 96;

type Props = {
  children?: ReactNode;
  /** Wrap children in a ScrollView. Off for screens with their own FlatList. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Leave room for the floating tab bar. */
  tabBarClearance?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Screen scaffold: ambient mesh background, safe-area handling and consistent
 * padding. Every route renders inside one of these.
 */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  tabBarClearance = false,
  padded = true,
  contentStyle,
  style,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const inner: StyleProp<ViewStyle> = [
    padded && styles.padded,
    {
      paddingBottom:
        (tabBarClearance ? TAB_BAR_CLEARANCE : theme.spacing.lg) + insets.bottom,
    },
    contentStyle,
  ];

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
