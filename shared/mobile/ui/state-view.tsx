import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';

import { GlassCard } from '@shared/ui/glass-card';
import { PressableScale } from '@shared/ui/pressable-scale';
import { makeStyles, useTheme } from '@shared/theme';

type Tone = 'neutral' | 'danger' | 'warning';

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail?: string | null;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/**
 * Full-screen empty / error / permission state.
 *
 * Exists because a bare `<ActivityIndicator/>` with no exit is indistinguishable
 * from a hung screen — the user cannot tell "still loading" from "this will
 * never finish", and has no way to recover.
 */
export function StateView({
  icon = 'information-circle-outline',
  title,
  detail,
  tone = 'neutral',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const accent =
    tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : theme.brandOn;
  const accentSoft =
    tone === 'danger'
      ? theme.dangerSoft
      : tone === 'warning'
        ? theme.warningSoft
        : theme.brandAlpha(theme.isDark ? 0.2 : 0.1);

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <View style={[styles.badge, { backgroundColor: accentSoft }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}

        {!!(actionLabel && onAction) && (
          <PressableScale
            haptic
            onPress={onAction}
            accessibilityRole="button"
            style={[styles.action, { backgroundColor: theme.brand }]}>
            <Text style={[styles.actionText, { color: theme.brandForeground }]}>
              {actionLabel}
            </Text>
          </PressableScale>
        )}
        {!!(secondaryLabel && onSecondary) && (
          <PressableScale
            onPress={onSecondary}
            accessibilityRole="button"
            style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: theme.brandOn }]}>
              {secondaryLabel}
            </Text>
          </PressableScale>
        )}
      </GlassCard>
    </View>
  );
}

/** Centred spinner with a label, so a wait always says what it is waiting for. */
export function LoadingView({ label }: { label?: string }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={theme.brandOn} size="large" />
      {!!label && <Text style={styles.detail}>{label}</Text>}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xl,
    gap: t.spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.md,
  },
  title: {
    fontSize: t.typography.title.fontSize,
    fontWeight: '800',
    color: t.heading,
    textAlign: 'center',
  },
  detail: {
    fontSize: t.typography.body.fontSize,
    color: t.body,
    textAlign: 'center',
    marginTop: t.spacing.xs,
    lineHeight: 21,
  },
  action: {
    marginTop: t.spacing.lg,
    alignSelf: 'stretch',
    borderRadius: t.radius.lg,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    marginTop: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  secondaryText: {
    fontWeight: '600',
    fontSize: 14,
  },
}));
