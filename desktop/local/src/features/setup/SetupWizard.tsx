import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyBrandTheme, DEFAULT_BRAND_COLOR } from '../../lib/theme'
import type { BackupProgressEvent, BackupProgressPhase, CompleteSetupPayload } from '../../../shared/types/api'
import { Badge, FadeIn } from '../../components/ui'
import { AuthShell } from '../../components/layout'
import { LicenseStep } from './steps/LicenseStep'
import { RestoreChoiceStep } from './steps/RestoreChoiceStep'
import { OwnerStep } from './steps/OwnerStep'
import { BusinessStep } from './steps/BusinessStep'
import { LanguageStep } from './steps/LanguageStep'
import type {
  BusinessFormValues,
  LanguageFormValues,
  LicenseFormValues,
  OwnerFormValues,
} from '../../schemas/setupSchemas'
import { cn } from '../../lib/cn'
import { setLanguage as applyAppLanguage } from '../../i18n'
import {
  defaultCurrencyForLanguage,
  normalizeAppLanguage,
  type AppLanguage,
} from '../../../shared/languages'

type Props = {
  onSetupDone: () => void
}

type Step = 'license' | 'mode' | 'owner' | 'business' | 'language'

const FRESH_STEPS: Step[] = ['license', 'mode', 'owner', 'business', 'language']

const STEP_LABEL_KEY: Record<Step, string> = {
  license: 'setup.stepLicense',
  mode: 'setup.stepMode',
  owner: 'setup.stepOwner',
  business: 'setup.stepBusiness',
  language: 'setup.stepLanguage',
}

const PHASE_I18N: Record<BackupProgressPhase, string> = {
  prepare_db: 'backup.progress.prepareDb',
  packing_files: 'backup.progress.packingFiles',
  compressing: 'backup.progress.compressing',
  encrypting: 'backup.progress.encrypting',
  writing: 'backup.progress.writing',
  reading: 'backup.progress.reading',
  decrypting: 'backup.progress.decrypting',
  extracting: 'backup.progress.extracting',
  installing_db: 'backup.progress.installingDb',
  restoring_files: 'backup.progress.restoringFiles',
  finalizing: 'backup.progress.finalizing',
}

export function SetupWizard({ onSetupDone }: Props) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState<Step>('license')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [progress, setProgress] = useState<BackupProgressEvent | null>(null)
  const [license, setLicense] = useState<LicenseFormValues>({ licenseKey: '' })
  const [owner, setOwner] = useState<OwnerFormValues>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const initialLang = normalizeAppLanguage(i18n.language)
  const [business, setBusiness] = useState<BusinessFormValues>({
    name: '',
    currency: defaultCurrencyForLanguage(initialLang),
    brandColor: DEFAULT_BRAND_COLOR,
    businessNature: 'retail',
    branchName: '',
    branchAddress: '',
    branchPhone: '',
  })
  const [language, setLanguage] = useState<LanguageFormValues>({ language: initialLang })
  /** Language active when business currency was last confirmed (for default-swap on language finish). */
  const [currencySeedLanguage, setCurrencySeedLanguage] = useState<AppLanguage>(initialLang)

  useEffect(() => {
    return window.api.backup.onProgress((event) => {
      setProgress(event)
    })
  }, [])

  const restoreProgress =
    loading && progress?.operation === 'restore'
      ? {
          percent: progress.percent,
          label: t(PHASE_I18N[progress.phase], { defaultValue: t('backup.progress.restoring') }),
        }
      : null

  const stepIndex = FRESH_STEPS.indexOf(step)
  const stepLabel = useMemo(
    () => t('setup.stepOf', { current: Math.max(stepIndex, 0) + 1, total: FRESH_STEPS.length }),
    [stepIndex, t],
  )

  const goBack = () => {
    const idx = FRESH_STEPS.indexOf(step)
    setStep(FRESH_STEPS[Math.max(0, idx - 1)] ?? 'license')
  }

  return (
    <AuthShell
      width="lg"
      brandAlign="start"
      title={t('setup.title')}
      tagline={t('setup.description')}
      headerExtra={
        <div className="space-y-3">
          <Badge tone="brand">{stepLabel}</Badge>
          <ol className="flex gap-1.5" aria-label={stepLabel}>
            {FRESH_STEPS.map((id, index) => {
              const done = index < stepIndex
              const current = index === stepIndex
              return (
                <li key={id} className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-colors duration-300',
                      done || current ? 'bg-brand-primary' : 'bg-surface-sunken',
                      current && 'shadow-[0_0_0_3px_rgb(var(--brand-primary)/0.18)]',
                    )}
                    aria-current={current ? 'step' : undefined}
                  />
                  <p
                    className={cn(
                      'mt-2 truncate text-[11px] font-medium',
                      current ? 'text-brand-primary' : done ? 'text-ink-muted' : 'text-ink-subtle',
                    )}
                  >
                    {t(STEP_LABEL_KEY[id])}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      }
      contentClassName="justify-start sm:py-8"
    >
      <FadeIn key={step}>
        {step === 'license' ? (
          <LicenseStep
            initial={license}
            loading={loading}
            error={error}
            onNext={async (values) => {
              setLoading(true)
              setError(undefined)
              const result = await window.api.license.activate(values.licenseKey)
              setLoading(false)

              if (!result.ok) {
                setError(result.message)
                return
              }

              setLicense(values)
              setStep('mode')
            }}
          />
        ) : null}

        {step === 'mode' ? (
          <RestoreChoiceStep
            loading={loading}
            error={error}
            progress={restoreProgress}
            onBack={() => setStep('license')}
            onFresh={() => {
              setError(undefined)
              setProgress(null)
              setStep('owner')
            }}
            onRestore={async () => {
              setLoading(true)
              setError(undefined)
              setProgress(null)
              try {
                const filePath = await window.api.backup.pickFile()
                if (!filePath) {
                  setLoading(false)
                  setProgress(null)
                  return
                }
                setProgress({ operation: 'restore', phase: 'reading', percent: 0 })
                const result = await window.api.setup.restoreFromBackup({
                  filePath,
                  licenseKey: license.licenseKey,
                })
                setLoading(false)
                setProgress(null)
                if (!result.ok) {
                  setError(result.message)
                  return
                }
                const lang = await window.api.app.getLanguage()
                await applyAppLanguage(lang)
                onSetupDone()
              } catch (e) {
                setLoading(false)
                setProgress(null)
                setError(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            }}
          />
        ) : null}

        {step === 'owner' ? (
          <OwnerStep
            initial={owner}
            loading={loading}
            onBack={() => setStep('mode')}
            onNext={(values) => {
              setOwner(values)
              setStep('business')
            }}
          />
        ) : null}

        {step === 'business' ? (
          <BusinessStep
            initial={business}
            loading={loading}
            onBack={goBack}
            onNext={(values) => {
              setBusiness(values)
              setCurrencySeedLanguage(normalizeAppLanguage(i18n.language))
              applyBrandTheme(values.brandColor)
              setStep('language')
            }}
          />
        ) : null}

        {step === 'language' ? (
          <LanguageStep
            initial={language}
            loading={loading}
            error={error}
            onBack={goBack}
            onFinish={async (values) => {
              setLanguage(values)
              setLoading(true)
              setError(undefined)

              const prevDefault = defaultCurrencyForLanguage(currencySeedLanguage)
              const nextDefault = defaultCurrencyForLanguage(values.language)
              const currency =
                business.currency.trim().toUpperCase() === prevDefault
                  ? nextDefault
                  : business.currency.trim() || nextDefault

              const payload: CompleteSetupPayload = {
                licenseKey: license.licenseKey,
                owner: {
                  name: owner.name,
                  email: owner.email,
                  password: owner.password,
                },
                business: {
                  name: business.name,
                  currency,
                  brandColor: business.brandColor,
                  businessNature: business.businessNature,
                },
                branch: {
                  name: business.branchName,
                  address: business.branchAddress,
                  phone: business.branchPhone,
                },
                language: values.language,
              }

              const result = await window.api.setup.complete(payload)
              setLoading(false)
              if (!result.ok) {
                setError(result.message)
                return
              }
              onSetupDone()
            }}
          />
        ) : null}
      </FadeIn>
    </AuthShell>
  )
}
