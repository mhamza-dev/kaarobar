import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface, type GlassIntensity } from '@shared/ui/glass-surface';
import { makeStyles, useTheme } from '@shared/theme';

type Props = {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Rendered at the top-right of the header row. */
  action?: ReactNode;
  intensity?: GlassIntensity;
  strong?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Standard content container: glass surface + optional header + elevation. */
export function GlassCard({
  children,
  title,
  subtitle,
  action,
  intensity = 'card',
  strong,
  padded = true,
  style,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <GlassSurface
      intensity={intensity}
      strong={strong}
      style={[styles.shell, theme.elevation.md, style]}>
      <View style={padded ? styles.padded : undefined}>
        {(title || action) && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {!!title && <Text style={styles.title}>{title}</Text>}
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {action}
          </View>
        )}
        {children}
      </View>
    </GlassSurface>
  );
}

const useStyles = makeStyles((t) => ({
  shell: {
    borderRadius: t.radius.xl,
  },
  padded: {
    padding: t.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: t.typography.heading.fontSize,
    fontWeight: '700',
    color: t.heading,
  },
  subtitle: {
    fontSize: t.typography.caption.fontSize,
    fontWeight: '500',
    color: t.muted,
  },
}));
