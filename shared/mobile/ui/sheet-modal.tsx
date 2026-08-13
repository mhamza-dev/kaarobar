import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@shared/ui/glass-surface';
import { makeStyles, useTheme } from '@shared/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Pinned to the bottom, outside the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  /** Back chevron instead of a close X, for stacked sheets. */
  onBack?: () => void;
  scroll?: boolean;
};

/**
 * Bottom sheet used for POS flows (cart, customer picker, till).
 *
 * The sheet caps at 88% height and scrolls internally so a long cart never
 * pushes the primary action off-screen — the "place order" button stays
 * reachable no matter how many lines are in the basket.
 */
export function SheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  onBack,
  scroll = true,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Dismiss" />
        <GlassSurface
          intensity="modal"
          strong
          radius={theme.radius['2xl']}
          style={[styles.sheet, theme.elevation.lg]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={theme.brandOn} />
              </Pressable>
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          {scroll ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>{children}</View>
          )}

          {!!footer && (
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
              ]}>
              {footer}
            </View>
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: t.scrim },
  sheet: {
    maxHeight: '88%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.borderStrong,
    marginTop: t.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: t.heading },
  subtitle: { fontSize: 12, fontWeight: '500', color: t.muted },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md, gap: t.spacing.sm },
  footer: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.divider,
  },
}));
