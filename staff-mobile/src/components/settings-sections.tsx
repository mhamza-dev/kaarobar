import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { AppearanceSwitcher } from '@/components/appearance-switcher';
import { GlassCard } from '@shared/ui/glass-card';
import { PressableScale } from '@shared/ui/pressable-scale';
import type { Session } from '@/lib/api';
import { pushPath } from '@/lib/nav';
import { canAccess, canAccessRoute, isOwner } from '@/lib/rbac';
import { makeStyles, useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Row = {
  key: string;
  icon: IconName;
  label: string;
  hint?: string;
  path: string;
  /** Only rendered when this resolves true for the session. */
  visible: boolean;
};

/**
 * Grouped entry points for Settings: what belongs to the signed-in person, and
 * what belongs to the business. Business rows are filtered by the same RBAC
 * helpers the API enforces (TEN-FR — UI is never the only gate).
 */
export function SettingsSections({ session }: { session: Session | null }) {
  const styles = useStyles();
  const owner = isOwner(session);

  const accountRows: Row[] = [
    {
      key: 'attendance',
      icon: 'time-outline',
      label: 'Attendance & leave',
      hint: 'Clock in/out, leave requests, payslips',
      path: '/app/ess',
      visible: canAccess(session, 'employee_self'),
    },
    {
      key: 'notifications',
      icon: 'notifications-outline',
      label: 'Notifications',
      hint: 'Alerts and push preferences',
      path: '/app/notifications',
      visible: true,
    },
  ];

  const businessRows: Row[] = [
    {
      key: 'workspace',
      icon: 'grid-outline',
      label: 'Workspace & reports',
      hint: 'Sales, cash and stock overview',
      path: '/app/dashboard',
      visible: canAccess(session, 'reports'),
    },
    {
      key: 'businesses',
      icon: 'business-outline',
      label: 'Businesses & branches',
      hint: 'Branding, branches, industry presets',
      path: '/app/businesses',
      visible: canAccess(session, 'owner_manage'),
    },
    {
      key: 'marketing',
      icon: 'megaphone-outline',
      label: 'Marketing',
      hint: 'Campaigns, templates and audiences',
      path: '/app/marketing',
      visible: canAccessRoute(session, '/app/marketing'),
    },
    {
      key: 'returns',
      icon: 'swap-horizontal-outline',
      label: 'Returns & tills',
      hint: 'Approve returns, reconcile tills',
      path: '/app/returns',
      visible: canAccessRoute(session, '/app/returns'),
    },
    {
      key: 'leave',
      icon: 'checkmark-done-outline',
      label: 'Leave approvals',
      hint: 'Review staff leave requests',
      path: '/app/leave',
      visible: canAccess(session, 'leave_approve'),
    },
  ];

  const visibleBusiness = businessRows.filter((r) => r.visible);

  return (
    <View style={styles.wrap}>
      <GlassCard title="Appearance" subtitle="Applies to this device only">
        <AppearanceSwitcher />
      </GlassCard>

      <GlassCard title="Your account" padded={false}>
        <View style={styles.list}>
          {accountRows
            .filter((r) => r.visible)
            .map((row, i, arr) => (
              <SettingsRow key={row.key} row={row} last={i === arr.length - 1} />
            ))}
        </View>
      </GlassCard>

      {visibleBusiness.length > 0 && (
        <GlassCard
          title="Business"
          subtitle={owner ? 'You own this workspace' : 'Available to your role'}
          padded={false}>
          <View style={styles.list}>
            {visibleBusiness.map((row, i) => (
              <SettingsRow
                key={row.key}
                row={row}
                last={i === visibleBusiness.length - 1}
              />
            ))}
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function SettingsRow({ row, last }: { row: Row; last: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityHint={row.hint}
      onPress={() => pushPath(row.path)}
      style={[styles.row, !last && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.brandAlpha(theme.isDark ? 0.2 : 0.1) }]}>
        <Ionicons name={row.icon} size={18} color={theme.brandOn} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        {!!row.hint && (
          <Text style={styles.rowHint} numberOfLines={1}>
            {row.hint}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    gap: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  list: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: t.heading,
  },
  rowHint: {
    fontSize: 12,
    color: t.muted,
    fontWeight: '500',
  },
}));
