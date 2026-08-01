"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./messages/en.json";
import ur from "./messages/ur.json";
import de from "./messages/de.json";
import ptBR from "./messages/pt-BR.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import ar from "./messages/ar.json";

export const LOCALES = ["en", "ur", "de", "pt-BR", "es", "fr", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ur", "ar"]);

export const LOCALE_NATIVE_LABELS: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
  es: "Español",
  fr: "Français",
  ar: "العربية",
};

type Dict = typeof en;

const catalogs: Record<Locale, Dict> = {
  en,
  ur,
  de,
  "pt-BR": ptBR,
  es,
  fr,
  ar,
};

const LOCALE_KEY = "kaarobar_locale";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

/** BCP 47 tag for `document.documentElement.lang`. */
export function htmlLang(locale: Locale): string {
  return locale;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const raw = localStorage.getItem(LOCALE_KEY);
  return isLocale(raw) ? raw : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  useEffect(() => {
    const dir = localeDir(locale);
    document.documentElement.lang = htmlLang(locale);
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text =
        lookup(catalogs[locale], key) ??
        lookup(catalogs.en, key) ??
        key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      dir: localeDir(locale),
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
