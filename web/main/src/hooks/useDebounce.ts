"use client";

import { useEffect, useState } from "react";

/**
 * Delays a rapidly-changing value — a search box feeding a backend query.
 *
 * The timer is cleared on every change, so only a pause longer than `delay`
 * lets the value through; an unmount mid-flight cancels it rather than
 * setting state on a gone component.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
