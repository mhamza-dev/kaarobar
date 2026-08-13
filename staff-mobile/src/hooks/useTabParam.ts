import { useLocalSearchParams } from 'expo-router';
import { router } from '@/lib/nav';
import { useCallback, useEffect, useMemo, useState } from "react";

type Options<T extends string> = {
  isAllowed?: (tab: T) => boolean;
};

/**
 * Persist the active screen tab in route `params.tab` (Settings pattern).
 */
export function useTabParam<T extends string>(
  defaultTab: T,
  validTabs: readonly T[],
  options?: Options<T>
): [T, (next: T) => void] {
  const routeParams = useLocalSearchParams();
  const isAllowed = options?.isAllowed;
  const validSet = useMemo(() => new Set<string>(validTabs), [validTabs]);
  const paramTab =
    routeParams && typeof routeParams === "object" && "tab" in routeParams
      ? (routeParams as { tab?: string }).tab
      : undefined;

  const resolve = useCallback(
    (raw: string | null | undefined): T => {
      if (raw && validSet.has(raw)) {
        const candidate = raw as T;
        if (!isAllowed || isAllowed(candidate)) return candidate;
      }
      return defaultTab;
    },
    [defaultTab, isAllowed, validSet]
  );

  const [tab, setTabState] = useState<T>(() => resolve(paramTab));

  const setTab = useCallback(
    (next: T) => {
      const resolved =
        validSet.has(next) && (!isAllowed || isAllowed(next)) ? next : defaultTab;
      setTabState(resolved);
      router.setParams({ tab: resolved } as never);
    },
    [defaultTab, isAllowed, validSet]
  );

  useEffect(() => {
    setTabState(resolve(paramTab));
  }, [paramTab, resolve]);

  return [tab, setTab];
}
