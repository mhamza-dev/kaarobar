import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getSession, isConsumerSession } from "./api";
import {
  brandPaletteFromPrimary,
  normalizeBrandHex,
  type BrandPalette,
} from "./brandTheme";

type BrandThemeContextValue = {
  palette: BrandPalette;
  setPrimaryColor: (hex: string | null | undefined) => void;
  refreshStaffBrand: () => void;
};

const BrandThemeContext = createContext<BrandThemeContextValue | null>(null);

export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  const [staffPrimary, setStaffPrimary] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refreshStaffBrand = useCallback(() => setTick((n) => n + 1), []);

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
          "/businesses",
          {},
          session
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

  const activeHex = override ?? staffPrimary;
  const palette = useMemo(() => brandPaletteFromPrimary(activeHex), [activeHex]);

  const value = useMemo(
    () => ({ palette, setPrimaryColor, refreshStaffBrand }),
    [palette, setPrimaryColor, refreshStaffBrand]
  );

  return (
    <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>
  );
}

export function useBrandPalette(): BrandPalette {
  const ctx = useContext(BrandThemeContext);
  return ctx?.palette ?? brandPaletteFromPrimary(null);
}

export function useBrandTheme(): BrandThemeContextValue {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) {
    const palette = brandPaletteFromPrimary(null);
    return {
      palette,
      setPrimaryColor: () => undefined,
      refreshStaffBrand: () => undefined,
    };
  }
  return ctx;
}
