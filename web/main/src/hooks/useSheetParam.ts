"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Which record a list screen's side sheet is showing, kept in the URL
 * (`?view=<id>`) rather than component state — so a sheet can be linked to
 * or reloaded, and the browser's Back button closes it.
 *
 * Opening pushes a history entry (that is what makes Back work); closing
 * replaces it, so a sheet opened from a shared link doesn't leave the user
 * a Back press that goes nowhere visible.
 */
export function useSheetParam(key = "view") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key);

  const hrefWith = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(key, next);
      else params.delete(key);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [key, pathname, searchParams],
  );

  const open = useCallback(
    (id: string) => router.push(hrefWith(id), { scroll: false }),
    [router, hrefWith],
  );
  const close = useCallback(
    () => router.replace(hrefWith(null), { scroll: false }),
    [router, hrefWith],
  );

  return { value, open, close };
}
