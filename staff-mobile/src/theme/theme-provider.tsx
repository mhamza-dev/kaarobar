import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { api, getSession, isConsumerSession } from '@/lib/api';
import { ThemeValueProvider } from '@shared/theme/context';
import { brandPaletteFromPrimary, normalizeBrandHex, type ColorScheme } from '@core/lib/brand-palette';
import { buildTheme, type Theme } from '@shared/theme/tokens';

/** What the user picked. `system` follows the OS setting. */
export type SchemePreference = 'system' | 'light' | 'dark';

const SCHEME_KEY = 'kaarobar_scheme';

type ThemeControls = {
  theme: Theme;
  /** Resolved scheme actually in use. */
  scheme: ColorScheme;
  /** What the user picked (may be `system`). */
  preference: SchemePreference;
  setPreference: (next: SchemePreference) => void;
  /** Override the brand colour (e.g. previewing a business in settings). */
  setPrimaryColor: (hex: string | null | undefined) => void;
  /** Re-read the signed-in business brand colour from the API. */
  refreshStaffBrand: () => void;
};

const ControlsContext = createContext<ThemeControls | null>(null);

/**
 * Derives the theme for this app and hands it to the shared `ThemeValueProvider`.
 *
 * This stays app-side because resolving the brand colour needs this app's API
 * client and session shape; shared components only ever consume the result.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<SchemePreference>('system');
  const [override, setOverride] = useState<string | null>(null);
  const [staffPrimary, setStaffPrimary] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SCHEME_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored);
        }
      } catch {
        // Preference is cosmetic — fall back to `system`.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: SchemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(SCHEME_KEY, next).catch(() => undefined);
  }, []);

  const refreshStaffBrand = useCallback(() => {
    setOverride(null);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!session || isConsumerSession(session) || !session.business_id) {
        if (!cancelled) setStaffPrimary(null);
        return;
      }
      try {
        const res = await api<{ data: { id: string; primary_color?: string | null }[] }>(
          '/businesses',
          {},
          session,
        );
        if (cancelled) return;
        const biz = (res.data || []).find((b) => b.id === session.business_id);
        setStaffPrimary(normalizeBrandHex(biz?.primary_color) || null);
      } catch {
        if (!cancelled) setStaffPrimary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const setPrimaryColor = useCallback((hex: string | null | undefined) => {
    setOverride(normalizeBrandHex(hex));
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const activeHex = override ?? staffPrimary;

  const theme = useMemo(
    () => buildTheme(scheme, brandPaletteFromPrimary(activeHex, scheme)),
    [scheme, activeHex],
  );

  const controls = useMemo(
    () => ({
      theme,
      scheme,
      preference,
      setPreference,
      setPrimaryColor,
      refreshStaffBrand,
    }),
    [theme, scheme, preference, setPreference, setPrimaryColor, refreshStaffBrand],
  );

  return (
    <ControlsContext value={controls}>
      <ThemeValueProvider theme={theme}>{children}</ThemeValueProvider>
    </ControlsContext>
  );
}

/** Scheme preference controls, for the appearance switcher in Settings. */
export function useThemeControls(): ThemeControls {
  const ctx = use(ControlsContext);
  if (!ctx) {
    const theme = buildTheme('light', brandPaletteFromPrimary(null, 'light'));
    return {
      theme,
      scheme: 'light',
      preference: 'system',
      setPreference: () => undefined,
      setPrimaryColor: () => undefined,
      refreshStaffBrand: () => undefined,
    };
  }
  return ctx;
}
