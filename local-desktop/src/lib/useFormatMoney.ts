import { useTranslation } from 'react-i18next'
import { normalizeAppLanguage, toBcp47 } from '../../shared/languages'
import { useActiveBusinessStore } from '../stores/activeBusinessStore'
import { formatCompactNumber, formatMoney } from './formatMoney'

function moneyUnits(t: (key: string) => string) {
  return {
    thousand: t('money.thousand'),
    million: t('money.million'),
    billion: t('money.billion'),
    lakh: t('money.lakh'),
    crore: t('money.crore'),
  }
}

/** Locale + language-aware money formatter; defaults to Business Settings currency. */
export function useFormatMoney() {
  const { t, i18n } = useTranslation()
  const language = normalizeAppLanguage(i18n.language)
  const locale = toBcp47(language)
  const units = moneyUnits(t)
  const businessCurrency = useActiveBusinessStore((s) => s.currency)

  return (value: number, currency?: string | null) =>
    formatMoney(value, currency ?? businessCurrency ?? 'PKR', {
      ...units,
      locale,
      language,
    })
}

/** Compact axis labels that follow the active UI language scale. */
export function useFormatCompactNumber() {
  const { t, i18n } = useTranslation()
  const language = normalizeAppLanguage(i18n.language)
  const locale = toBcp47(language)
  const units = moneyUnits(t)
  return (value: number) => formatCompactNumber(value, { ...units, locale, language })
}
