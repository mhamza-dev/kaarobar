import { Redirect } from 'expo-router';
// `Tabs` from the expo-router root is deprecated in SDK 57.
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassTabBar, TAB_BAR_CONTENT_HEIGHT } from '@/components/ui/glass-tab-bar';
import { t } from '@/lib/i18n';
import { useIsStaffAuthed, useSession } from '@/lib/SessionContext';
import { canAccessRoute } from '@/lib/rbac';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, loading } = useSession();
  const authed = useIsStaffAuthed();

  // Guard the whole workspace group rather than each screen (TEN — RBAC is still
  // enforced server-side; this is only navigation).
  if (loading) return null;
  if (!authed) return <Redirect href="/landing" />;

  // The glass tab bar floats above the content, so every scene must reserve its
  // height or the last row of every list sits under the bar.
  const tabBarSpace =
    TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, theme.spacing.sm) + theme.spacing.sm;

  const sceneStyle = {
    backgroundColor: theme.bgPrimary,
    // These tabs are headerless, so nothing else keeps content clear of the
    // status bar / notch.
    paddingTop: insets.top,
    paddingBottom: tabBarSpace,
  };

  /**
   * `href: null` removes a tab from the bar without unregistering the route, so
   * a cashier never sees Inventory while deep links still resolve. The API
   * remains the real gate (SEC-NFR-001).
   */
  const tabHref = (route: string) => (canAccessRoute(session, route) ? undefined : null);

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle }}>
      <Tabs.Screen
        name="pos"
        options={{ title: t('nav.pos'), href: tabHref('/app/pos') }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: t('nav.sales') || 'Sales', href: tabHref('/app/sales') }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: 'Products', href: tabHref('/app/inventory') }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: t('nav.customers'), href: tabHref('/app/customers') }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          // Settings is always reachable — it is where a user finds their
          // profile, appearance and whatever their role does allow.
          // Its nested Stack headers already handle the top inset, so adding it
          // here too would double-pad and push the header down.
          sceneStyle: { backgroundColor: theme.bgPrimary, paddingBottom: tabBarSpace },
        }}
      />
    </Tabs>
  );
}
