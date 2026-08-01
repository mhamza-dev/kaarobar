import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./i18n/en.json";
import ur from "./i18n/ur.json";
import de from "./i18n/de.json";
import ptBR from "./i18n/pt-BR.json";
import es from "./i18n/es.json";
import fr from "./i18n/fr.json";
import ar from "./i18n/ar.json";

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
  de: de as Dict,
  "pt-BR": ptBR as Dict,
  es: es as Dict,
  fr: fr as Dict,
  ar: ar as Dict,
};

const LOCALE_KEY = "kaarobar_locale";

let current: Locale = "en";

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

export function t(key: string, vars?: Record<string, string | number>): string {
  let text = lookup(catalogs[current], key) ?? lookup(catalogs.en, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function getLocale(): Locale {
  return current;
}

export async function loadLocale(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_KEY);
    current = isLocale(raw) ? raw : "en";
  } catch {
    current = "en";
  }
  applyRtl(current);
  return current;
}

export async function setLocale(locale: Locale): Promise<void> {
  current = locale;
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // ignore
  }
  applyRtl(locale);
}

function applyRtl(locale: Locale) {
  const rtl = RTL_LOCALES.has(locale);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}
