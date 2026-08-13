import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/toast';
import { loadLocale } from '@/lib/i18n';
import { makeQueryClient } from '@/lib/queryClient';
import { SessionProvider, useSession } from '@/lib/SessionContext';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [queryClient] = useState(() => makeQueryClient());
  const [localeReady, setLocaleReady] = useState(false);

  useEffect(() => {
    loadLocale().finally(() => setLocaleReady(true));
  }, []);

  if (!localeReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <RootStack />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Hides the splash only once the session read has settled, so the app never
 * flashes the landing screen before redirecting an already-signed-in user.
 */
function RootStack() {
  const theme = useTheme();
  const { loading } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bgPrimary },
          animation: 'fade',
          animationDuration: theme.motion.base,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
