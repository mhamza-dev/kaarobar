import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import KaarobarLogo from '@/components/kaarobar-logo';
import { t } from '@/lib/i18n';
import { useIsStaffAuthed, useSession } from '@/lib/SessionContext';
import { makeStyles, useTheme } from '@/theme';

/** Entry route: send staff to the workspace, everyone else to the landing page. */
export default function Index() {
  const styles = useStyles();
  const theme = useTheme();
  const { loading } = useSession();
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

  return <Redirect href={authed ? '/(tabs)/pos' : '/landing'} />;
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
