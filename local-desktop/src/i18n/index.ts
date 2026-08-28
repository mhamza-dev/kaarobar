import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  isRtlLanguage,
  normalizeAppLanguage,
  type AppLanguage,
} from '../../shared/languages'
import ar from './ar.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import pt from './pt.json'
import ur from './ur.json'

function applyDocumentLanguage(language: AppLanguage) {
  document.documentElement.lang = language
  document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr'
}

export async function initI18n(initialLanguage: AppLanguage) {
  const language = normalizeAppLanguage(initialLanguage)
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ur: { translation: ur },
      de: { translation: de },
      pt: { translation: pt },
      es: { translation: es },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

  applyDocumentLanguage(language)
}

export async function setLanguage(language: AppLanguage) {
  const next = normalizeAppLanguage(language)
  await i18n.changeLanguage(next)
  applyDocumentLanguage(next)
}

export { i18n }
