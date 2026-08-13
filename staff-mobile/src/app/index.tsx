import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import KaarobarLogo from '@/components/kaarobar-logo';
import { t } from '@/lib/i18n';
import { landingTabFor } from '@/lib/nav';
import { canAccessRoute } from '@/lib/rbac';
import { useIsStaffAuthed, useSession } from '@/lib/SessionContext';
import { makeStyles, useTheme } from '@/theme';

/** Entry route: send staff to the first tab their role can open. */
export default function Index() {
  const styles = useStyles();
  const theme = useTheme();
  const { session, loading } = useSession();
  const authed = useIsStaffAuthed();

  if (loading) {
    return (
      <View style={styles.root}>
        <KaarobarLogo size={56} />
        <ActivityIndicator color={theme.brandOn} />
        <Text style={styles.label}>{t('common.workspaceLoading')}</Text>
      </View>
    );
  }

  if (!authed) return <Redirect href="/landing" />;

  return <Redirect href={landingTabFor((route) => canAccessRoute(session, route))} />;
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.lg,
    backgroundColor: t.bgPrimary,
  },
  label: {
    color: t.body,
    fontSize: 14,
    fontWeight: '500',
  },
}));
