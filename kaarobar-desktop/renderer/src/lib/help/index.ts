import type { HelpCatalog } from "./types";
import type { Locale } from "@/lib/i18n";
import en from "./en";
import ur from "./ur";
import de from "./de";
import ptBR from "./pt-BR";
import es from "./es";
import fr from "./fr";
import ar from "./ar";

const catalogs: Record<Locale, HelpCatalog> = {
  en,
  ur,
  de,
  "pt-BR": ptBR,
  es,
  fr,
  ar,
};

export function getHelpTopic(locale: Locale, topicId: string) {
  return catalogs[locale]?.[topicId] ?? catalogs.en[topicId] ?? null;
}

export type { HelpTopic, HelpCatalog } from "./types";
