import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./i18n/en.json";
import ur from "./i18n/ur.json";

export type Locale = "en" | "ur";

type Dict = typeof en;
const catalogs: Record<Locale, Dict> = { en, ur };
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
    current = raw === "ur" ? "ur" : "en";
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
  const rtl = locale === "ur";
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}
