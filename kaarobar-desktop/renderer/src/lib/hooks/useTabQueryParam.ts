import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type Options<T extends string> = {
  /** Override path used in replace navigation (defaults to current location.pathname). */
  pathname?: string;
  isAllowed?: (tab: T) => boolean;
};

/**
 * Persist the active page tab in `?tab=` (Settings pattern) for react-router.
 */
export function useTabQueryParam<T extends string>(
  defaultTab: T,
  validTabs: readonly T[],
  options?: Options<T>
): [T, (next: T) => void] {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pathname = options?.pathname || location.pathname;
  const isAllowed = options?.isAllowed;
  const validSet = useMemo(() => new Set<string>(validTabs), [validTabs]);

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

  const [tab, setTabState] = useState<T>(() => resolve(searchParams.get("tab")));

  const setTab = useCallback(
    (next: T) => {
      const resolved =
        validSet.has(next) && (!isAllowed || isAllowed(next)) ? next : defaultTab;
      setTabState(resolved);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", resolved);
      const qs = params.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true });
    },
    [defaultTab, isAllowed, navigate, pathname, searchParams, validSet]
  );

  useEffect(() => {
    setTabState(resolve(searchParams.get("tab")));
  }, [resolve, searchParams]);

  return [tab, setTab];
}
