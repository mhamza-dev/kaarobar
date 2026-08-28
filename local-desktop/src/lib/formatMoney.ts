import type { AppLanguage } from '../../shared/languages'
import { normalizeAppLanguage, toBcp47 } from '../../shared/languages'
import { currencyPrefix } from './currency'

const THOUSAND = 1_000
const HUNDRED_THOUSAND = 100_000
const MILLION = 1_000_000
const BILLION = 1_000_000_000
const LAKH = 100_000
const CRORE = 10_000_000

export type FormatMoneyUnits = {
  thousand: string
  million: string
  billion: string
  lakh: string
  crore: string
}

export type FormatMoneyOptions = FormatMoneyUnits & {
  /** BCP-47 locale for number grouping (e.g. en-US, de-DE). */
  locale?: string
  /** UI language — drives K/M vs Lakh/Crore compact style. */
  language?: AppLanguage | string
}

const DEFAULT_UNITS: FormatMoneyUnits = {
  thousand: 'K',
  million: 'M',
  billion: 'B',
  lakh: 'Lakh',
  crore: 'Crore',
}

function formatNumber(value: number, locale: string, min: number, max: number): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
}

function moneyLocale(options?: Partial<FormatMoneyOptions>): string {
  return options?.locale ?? toBcp47(normalizeAppLanguage(options?.language))
}

function roundCompact(value: number): number {
  return Math.round(value * 100) / 100
}

/** Urdu uses South Asian scales; all other UI languages use K / M / B. */
export function usesSouthAsianMoneyScale(lang: AppLanguage | string | undefined): boolean {
  return normalizeAppLanguage(lang) === 'ur'
}

/**
 * Compact number (no currency) for chart axes — same language rules as formatMoney.
 */
export function formatCompactNumber(
  value: number,
  options?: Partial<FormatMoneyOptions>,
): string {
  const units: FormatMoneyUnits = { ...DEFAULT_UNITS, ...options }
  const locale = moneyLocale(options)
  const amount = Number.isFinite(value) ? value : 0
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)

  if (usesSouthAsianMoneyScale(options?.language)) {
    if (abs >= CRORE) {
      return `${sign}${formatNumber(roundCompact(abs / CRORE), locale, 0, 2)} ${units.crore}`
    }
    if (abs >= LAKH) {
      return `${sign}${formatNumber(roundCompact(abs / LAKH), locale, 0, 2)} ${units.lakh}`
    }
    return `${sign}${formatNumber(Math.round(abs), locale, 0, 0)}`
  }

  if (abs >= BILLION) {
    return `${sign}${formatNumber(roundCompact(abs / BILLION), locale, 0, 2)}${units.billion}`
  }
  if (abs >= MILLION) {
    return `${sign}${formatNumber(roundCompact(abs / MILLION), locale, 0, 2)}${units.million}`
  }
  if (abs >= HUNDRED_THOUSAND) {
    return `${sign}${formatNumber(roundCompact(abs / THOUSAND), locale, 0, 2)}${units.thousand}`
  }
  return `${sign}${formatNumber(Math.round(abs), locale, 0, 0)}`
}

/**
 * Display money with locale-aware grouping and language-based compact units.
 * English / Western UI: 100K, 1M, 10M, …
 * Urdu UI: Lakh / Crore (لاکھ / کروڑ)
 */
export function formatMoney(
  value: number,
  currency?: string | null,
  options?: Partial<FormatMoneyOptions>,
): string {
  const units: FormatMoneyUnits = {
    thousand: options?.thousand ?? DEFAULT_UNITS.thousand,
    million: options?.million ?? DEFAULT_UNITS.million,
    billion: options?.billion ?? DEFAULT_UNITS.billion,
    lakh: options?.lakh ?? DEFAULT_UNITS.lakh,
    crore: options?.crore ?? DEFAULT_UNITS.crore,
  }
  const locale = moneyLocale(options)
  const amount = Number.isFinite(value) ? value : 0
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const prefix = currencyPrefix(currency)

  if (usesSouthAsianMoneyScale(options?.language)) {
    if (abs >= CRORE) {
      return `${sign}${prefix} ${formatNumber(roundCompact(abs / CRORE), locale, 0, 2)} ${units.crore}`
    }
    if (abs >= LAKH) {
      return `${sign}${prefix} ${formatNumber(roundCompact(abs / LAKH), locale, 0, 2)} ${units.lakh}`
    }
    return `${sign}${prefix} ${formatNumber(abs, locale, 2, 2)}`
  }

  if (abs >= BILLION) {
    return `${sign}${prefix} ${formatNumber(roundCompact(abs / BILLION), locale, 0, 2)}${units.billion}`
  }
  if (abs >= MILLION) {
    return `${sign}${prefix} ${formatNumber(roundCompact(abs / MILLION), locale, 0, 2)}${units.million}`
  }
  if (abs >= HUNDRED_THOUSAND) {
    return `${sign}${prefix} ${formatNumber(roundCompact(abs / THOUSAND), locale, 0, 2)}${units.thousand}`
  }

  return `${sign}${prefix} ${formatNumber(abs, locale, 2, 2)}`
}
