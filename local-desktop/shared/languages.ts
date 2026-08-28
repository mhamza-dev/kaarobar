/** Supported UI / print languages for Kaarobar POS. */
export const APP_LANGUAGES = ['en', 'ur', 'de', 'pt', 'es', 'fr', 'ar'] as const

export type AppLanguage = (typeof APP_LANGUAGES)[number]

export type LanguageOption = {
  value: AppLanguage
  /** Native endonym shown in language pickers */
  label: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en', label: 'English (US)' },
  { value: 'ur', label: 'اردو' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
]

const RTL: ReadonlySet<AppLanguage> = new Set(['ur', 'ar'])

const BCP47: Record<AppLanguage, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  de: 'de-DE',
  pt: 'pt-BR',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
}

export function isAppLanguage(value: string): value is AppLanguage {
  return (APP_LANGUAGES as readonly string[]).includes(value)
}

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage {
  const language = value?.trim().toLowerCase().split(/[-_]/)[0]
  return language && isAppLanguage(language) ? language : 'en'
}

export function isRtlLanguage(lang: AppLanguage): boolean {
  return RTL.has(lang)
}

export function toBcp47(lang: AppLanguage): string {
  return BCP47[lang]
}

const DEFAULT_CURRENCY: Record<AppLanguage, string> = {
  en: 'USD',
  ur: 'PKR',
  de: 'EUR',
  es: 'EUR',
  fr: 'EUR',
  pt: 'BRL',
  ar: 'SAR',
}

/** Suggested business currency for a UI language (setup defaults only). */
export function defaultCurrencyForLanguage(lang: AppLanguage): string {
  return DEFAULT_CURRENCY[lang]
}
