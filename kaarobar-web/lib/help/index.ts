import type { HelpCatalog } from "./types";
import type { Locale } from "@/lib/i18n";
import en from "./en";
import ur from "./ur";

const catalogs: Record<Locale, HelpCatalog> = { en, ur };

export function getHelpTopic(locale: Locale, topicId: string) {
  return catalogs[locale]?.[topicId] ?? catalogs.en[topicId] ?? null;
}

export type { HelpTopic, HelpCatalog } from "./types";
