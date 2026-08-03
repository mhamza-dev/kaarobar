"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Options<T extends string> = {
  /**
   * Public URL path used in `router.replace` (e.g. `/app/marketing`).
   * Prefer this over `usePathname()` because `/app/*` is rewritten to `/workspace/*`.
   */
  basePath: string;
  /** When false, falls back to defaultTab (e.g. owner-only or RBAC-gated tabs). */
  isAllowed?: (tab: T) => boolean;
};

/**
 * Persist the active page tab in `?tab=` (Settings pattern).
 * Wrap the calling page in `<Suspense>` when used with Next.js `useSearchParams`.
 */
export function useTabQueryParam<T extends string>(
  defaultTab: T,
  validTabs: readonly T[],
  options: Options<T>
): [T, (next: T) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = options.basePath;
  const isAllowed = options.isAllowed;
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
      router.replace(`${basePath}?${params.toString()}`, { scroll: false });
    },
    [basePath, defaultTab, isAllowed, router, searchParams, validSet]
  );

  useEffect(() => {
    setTabState(resolve(searchParams.get("tab")));
  }, [resolve, searchParams]);

  return [tab, setTab];
}
