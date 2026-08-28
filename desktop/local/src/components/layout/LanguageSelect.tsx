import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS, normalizeAppLanguage, type AppLanguage } from '../../../shared/languages'
import { setLanguage } from '../../i18n'
import { SelectField } from '../ui'
import { cn } from '../../lib/cn'

type Props = {
  className?: string
  containerClassName?: string
}

/** Persist + apply UI language (header / auth chrome). */
export function LanguageSelect({ className, containerClassName }: Props) {
  const { t, i18n } = useTranslation()

  return (
    <SelectField
      aria-label={t('common.language')}
      value={normalizeAppLanguage(i18n.language)}
      options={LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
      onChange={async (value) => {
        const language = normalizeAppLanguage(value) as AppLanguage
        await window.api.app.setLanguage(language)
        await setLanguage(language)
      }}
      containerClassName={cn('w-full sm:w-40', containerClassName)}
      className={cn('h-10', className)}
    />
  )
}
