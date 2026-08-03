import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase, RouteProp } from "@react-navigation/native";

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
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<RouteProp<Record<string, { tab?: string } | undefined>, string>>();
  const isAllowed = options?.isAllowed;
  const validSet = useMemo(() => new Set<string>(validTabs), [validTabs]);
  const paramTab =
    route.params && typeof route.params === "object" && "tab" in route.params
      ? (route.params as { tab?: string }).tab
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
      navigation.setParams({ tab: resolved } as never);
    },
    [defaultTab, isAllowed, navigation, validSet]
  );

  useEffect(() => {
    setTabState(resolve(paramTab));
  }, [paramTab, resolve]);

  return [tab, setTab];
}
