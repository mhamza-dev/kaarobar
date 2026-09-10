"use client";

import { useEffect } from "react";

import { applyBrandTheme, resetBrandTheme } from "@/lib/theme";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Keeps `:root`'s brand CSS variables in sync with the current business's
 * `brand_color` — mount once, high in the authenticated tree
 * ((app)/layout.tsx). Resets to the default Kaarobar blue when there's no
 * business selected (the pre-tenant screens: /me, org picker) rather than
 * leaving a previous business's color applied.
 */
export function useBrandTheme() {
  const brandColor = useSessionStore((state) => state.scope?.business?.brand_color ?? null);

  useEffect(() => {
    if (brandColor) {
      applyBrandTheme(brandColor);
    } else {
      resetBrandTheme();
    }
  }, [brandColor]);
}
