"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { api, getSession, isConsumerSession } from "@/lib/api/client";
import {
  brandCssVars,
  brandTokensFromPrimary,
  normalizeBrandHex,
  type BrandTokens,
} from "@/lib/brand-theme";

const BRAND_VAR_KEYS = [
  "--brand",
  "--brand-hover",
  "--brand-active",
  "--brand-foreground",
  "--brand-soft",
  "--brand-light",
  "--brand-subtle",
  "--brand-muted",
  "--brand-gradient",
  "--brand-gradient-soft",
  "--shadow-brand",
  "--border-focus",
  "--link",
  "--link-hover",
  "--rail-active",
  "--color-brand",
  "--color-brand-hover",
  "--color-brand-active",
  "--color-brand-foreground",
  "--color-brand-soft",
  "--color-brand-light",
  "--color-brand-subtle",
  "--color-brand-muted",
] as const;

/** Force brand tokens onto an element (uses !important to beat theme layer). */
export function applyBrandVars(
  el: HTMLElement | null | undefined,
  hex: string | null | undefined
) {
  if (typeof document === "undefined" || !el) return;
  const normalized = normalizeBrandHex(hex);
  if (!normalized) {
    clearBrandVars(el);
    return;
  }
  const vars = brandCssVars(normalized);
  if (!vars) {
    clearBrandVars(el);
    return;
  }
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value, "important");
  }
  el.setAttribute("data-brand-theme", normalized);
}

export function clearBrandVars(el: HTMLElement | null | undefined) {
  if (typeof document === "undefined" || !el) return;
  for (const key of BRAND_VAR_KEYS) {
    el.style.removeProperty(key);
  }
  el.removeAttribute("data-brand-theme");
}

/** Apply brand theme to the whole document (staff chrome). */
export function applyDocumentBrand(hex: string | null | undefined) {
  if (typeof document === "undefined") return;
  applyBrandVars(document.documentElement, hex);
}

export function clearDocumentBrand() {
  if (typeof document === "undefined") return;
  clearBrandVars(document.documentElement);
}

type BrandThemeContextValue = {
  hex: string | null;
  tokens: BrandTokens;
  setPreviewHex: (hex: string | null) => void;
};

const BrandThemeContext = createContext<BrandThemeContextValue | null>(null);

export function useBrandThemeTokens(): BrandTokens {
  const ctx = useContext(BrandThemeContext);
  return ctx?.tokens ?? brandTokensFromPrimary(null);
}

export function useBrandThemeHex(): string | null {
  return useContext(BrandThemeContext)?.hex ?? null;
}

/** Nested scope for local previews (also paints document when `paintDocument`). */
export function BrandThemeScope({
  primaryColor,
  className = "",
  children,
  paintDocument = false,
}: {
  primaryColor?: string | null;
  className?: string;
  children: ReactNode;
  paintDocument?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyBrandVars(ref.current, primaryColor);
    if (paintDocument) applyDocumentBrand(primaryColor);
  }, [primaryColor, paintDocument]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Staff workspace: load saved primary_color and keep <html> --brand* in sync.
 * Call setPreviewHex / previewStaffBrand while editing for instant chrome updates.
 */
export function StaffBrandProvider({
  businessId,
  children,
}: {
  businessId?: string | null;
  children: ReactNode;
}) {
  const [savedHex, setSavedHex] = useState<string | null>(null);
  const [previewHex, setPreviewHex] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const hex = previewHex ?? savedHex;
  const tokens = useMemo(() => brandTokensFromPrimary(hex), [hex]);

  useEffect(() => {
    function bump() {
      setTick((n) => n + 1);
    }
    function onPreview(e: Event) {
      const detail = (e as CustomEvent<{ primaryColor?: string | null }>).detail;
      setPreviewHex(normalizeBrandHex(detail?.primaryColor) || null);
    }
    function onClearPreview() {
      setPreviewHex(null);
    }
    window.addEventListener("kaarobar:branding", bump);
    window.addEventListener("kaarobar:session", bump);
    window.addEventListener("kaarobar:branding-preview", onPreview);
    window.addEventListener("kaarobar:branding-preview-clear", onClearPreview);
    return () => {
      window.removeEventListener("kaarobar:branding", bump);
      window.removeEventListener("kaarobar:session", bump);
      window.removeEventListener("kaarobar:branding-preview", onPreview);
      window.removeEventListener("kaarobar:branding-preview-clear", onClearPreview);
    };
  }, []);

  useEffect(() => {
    if (!businessId) {
      setSavedHex(null);
      return;
    }
    const session = getSession();
    if (!session || isConsumerSession(session)) {
      setSavedHex(null);
      return;
    }
    let cancelled = false;
    void api<{ data: { id: string; primary_color?: string | null }[] }>("/businesses")
      .then((res) => {
        if (cancelled) return;
        const biz = (res.data || []).find((b) => b.id === businessId);
        setSavedHex(normalizeBrandHex(biz?.primary_color) || null);
      })
      .catch(() => {
        if (!cancelled) setSavedHex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, tick]);

  useEffect(() => {
    if (!businessId) {
      clearDocumentBrand();
      return;
    }
    applyDocumentBrand(hex);
  }, [businessId, hex]);

  useEffect(() => {
    return () => clearDocumentBrand();
  }, []);

  const value = useMemo(
    () => ({ hex, tokens, setPreviewHex }),
    [hex, tokens]
  );

  return (
    <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>
  );
}

/** @deprecated use StaffBrandProvider — kept for call sites that only need the hex */
export function useStaffBrandColor(businessId?: string | null): string | null {
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    if (!businessId) {
      setHex(null);
      return;
    }
    let cancelled = false;
    void api<{ data: { id: string; primary_color?: string | null }[] }>("/businesses")
      .then((res) => {
        if (cancelled) return;
        const biz = (res.data || []).find((b) => b.id === businessId);
        setHex(normalizeBrandHex(biz?.primary_color) || null);
      })
      .catch(() => {
        if (!cancelled) setHex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);
  return hex;
}

export function staffBrandStyle(primaryColor: string | null) {
  return brandCssVars(primaryColor) as CSSProperties | undefined;
}

/** Instant chrome update — always paints document (settings branding picker). */
export function previewStaffBrand(_businessId: string, primaryColor: string | null | undefined) {
  const hex = normalizeBrandHex(primaryColor);
  applyDocumentBrand(hex);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("kaarobar:branding-preview", {
      detail: { businessId: _businessId, primaryColor: hex },
    })
  );
}

export function clearStaffBrandPreview() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("kaarobar:branding-preview-clear"));
}
