import { Redirect, Tabs } from 'expo-router';

import { GlassTabBar } from '@/components/ui/glass-tab-bar';
import { t } from '@/lib/i18n';
import { useIsStaffAuthed, useSession } from '@/lib/SessionContext';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const { loading } = useSession();
  const authed = useIsStaffAuthed();

  // Guard the whole workspace group rather than each screen (TEN — RBAC is still
  // enforced server-side; this is only navigation).
  if (loading) return null;
  if (!authed) return <Redirect href="/landing" />;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bgPrimary },
      }}>
      <Tabs.Screen name="pos" options={{ title: t('nav.pos') }} />
      <Tabs.Screen name="sales" options={{ title: t('nav.sales') || 'Sales' }} />
      <Tabs.Screen name="products" options={{ title: 'Products' }} />
      <Tabs.Screen name="customers" options={{ title: t('nav.customers') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
