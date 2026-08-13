import { Stack } from 'expo-router';

import { t } from '@shared/i18n';
import { useTheme } from '@/theme';

export default function SettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        // Deliberately NOT headerTransparent: a transparent header makes every
        // screen responsible for its own top inset, and each of these screens
        // renders a plain ScrollView, so the first row ended up under the title.
        headerStyle: { backgroundColor: theme.bgSecondary },
        headerTintColor: theme.heading,
        headerTitleStyle: { color: theme.heading, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bgPrimary },
        animation: 'slide_from_right',
        animationDuration: theme.motion.base,
      }}>
      <Stack.Screen name="index" options={{ title: t('nav.settings') }} />
      <Stack.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Stack.Screen name="workspace" options={{ title: 'Workspace' }} />
      <Stack.Screen name="leave" options={{ title: 'Leave approvals' }} />
      <Stack.Screen name="notifications" options={{ title: t('nav.notifications') }} />
      <Stack.Screen name="returns" options={{ title: t('nav.returns') }} />
      <Stack.Screen name="profile" options={{ title: t('nav.profile') || 'Profile' }} />
      <Stack.Screen name="businesses/index" options={{ title: t('nav.businesses') }} />
      <Stack.Screen
        name="businesses/[id]"
        options={{ title: t('pages.businessDetailTitle') }}
      />
      <Stack.Screen name="marketing/index" options={{ title: t('nav.marketing') }} />
      <Stack.Screen
        name="marketing/template/[id]"
        options={{ title: t('marketing.templateFallback') }}
      />
    </Stack>
  );
}
