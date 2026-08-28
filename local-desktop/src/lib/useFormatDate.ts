import { useTranslation } from 'react-i18next'
import { normalizeAppLanguage } from '../../shared/languages'
import { formatDate, formatDateTime } from './formatDate'

/** Locale-aware date formatters bound to the active UI language. */
export function useFormatDate() {
  const { i18n } = useTranslation()
  const lang = normalizeAppLanguage(i18n.language)
  return {
    formatDate: (iso: string | number | Date) => formatDate(iso, lang),
    formatDateTime: (iso: string | number | Date) => formatDateTime(iso, lang),
  }
}
