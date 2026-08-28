import { useCallback, useEffect, useRef, useState } from 'react'
import { Form, Formik, useFormikContext } from 'formik'
import { useTranslation } from 'react-i18next'
import { Button, Card, EmptyState, Tabs, useToast } from '../../../components/ui'
import { FormTextField, FormSelectField, FormTextareaField } from '../../../components/form'
import { ColorPickerField } from '../../../components/form/ColorPickerField'
import { PageHeader } from '../../../components/layout'
import { businessCreateSchema, businessSettingsCurrencySchema } from '../../../schemas/adminSchemas'
import { DEFAULT_BRAND_COLOR, applyBrandTheme, resolveBrandPresetHex } from '../../../lib/theme'
import { useActionVisibility } from '../../../lib/nav'
import { assetSrc } from '../../../lib/assets'
import { currencyOptionsForValue } from '../../../../shared/currencies'
import { useActiveBusinessStore } from '../../../stores/activeBusinessStore'
import { Lock } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { useLicenseLimits } from '../../../lib/license'
import { normalizeSocialLink, denormalizeSocialLink } from '../lib/socialLinks'
import { buildReceiptSample } from '../lib/receiptPreviewSample'
import { LicensePlanCard } from '../components/LicensePlanCard'
import { ReceiptEnginePreview } from '../components/ReceiptEnginePreview'
import { ReceiptPrinterCard } from '../components/ReceiptPrinterCard'
import type {
  PosPrinterSettings,
  PosReceiptTemplate,
  SessionUser,
} from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'
import * as yup from 'yup'

type Props = {
  user: SessionUser
  data: AdminData
}

type SettingsTab = 'business' | 'invoice'

/** Formik fields whose inputs live on the Invoice tab. */
const INVOICE_TAB_FIELDS = new Set(['receiptHeader', 'receiptFooter'])

/** Selectable receipt styles; selecting one re-renders the single preview. */
const RECEIPT_TEMPLATES: Array<{ id: PosReceiptTemplate; labelKey: string }> = [
  { id: 'classic', labelKey: 'printer.templateClassic' },
  { id: 'minimal', labelKey: 'printer.templateMinimal' },
  { id: 'dotted', labelKey: 'printer.templateDotted' },
  { id: 'mono', labelKey: 'printer.templateMono' },
  { id: 'bold', labelKey: 'printer.templateBold' },
  { id: 'elegant', labelKey: 'printer.templateElegant' },
  { id: 'boxed', labelKey: 'printer.templateBoxed' },
  { id: 'stripe', labelKey: 'printer.templateStripe' },
  { id: 'soft', labelKey: 'printer.templateSoft' },
  { id: 'script', labelKey: 'printer.templateScript' },
  { id: 'accent', labelKey: 'printer.templateAccent' },
  { id: 'framed', labelKey: 'printer.templateFramed' },
  { id: 'duo', labelKey: 'printer.templateDuo' },
  { id: 'vintage', labelKey: 'printer.templateVintage' },
  { id: 'ticket', labelKey: 'printer.templateTicket' },
  { id: 'ledger', labelKey: 'printer.templateLedger' },
  { id: 'deluxe', labelKey: 'printer.templateDeluxe' },
  { id: 'wave', labelKey: 'printer.templateWave' },
  { id: 'market', labelKey: 'printer.templateMarket' },
  { id: 'regal', labelKey: 'printer.templateRegal' },
]

function buildSettingsSchema(currentCurrency?: string | null) {
  return businessCreateSchema
    .concat(businessSettingsCurrencySchema(currentCurrency))
    .concat(
      yup.object({
        branchName: yup.string().trim().required('Branch name is required'),
        branchAddress: yup.string().trim().default(''),
        branchPhone: yup.string().trim().default(''),
        receiptHeader: yup.string().trim().max(240, 'Header message is too long').default(''),
        receiptFooter: yup.string().trim().max(320, 'Footer message is too long').default(''),
      }),
    )
}

/**
 * With the form split across tabs, a failed submit can leave every visible
 * field valid while the real error hides on the other tab. Jump to the tab
 * that owns the first error so the save button never appears to do nothing.
 */
function TabErrorSync({ onJump }: { onJump: (tab: SettingsTab) => void }) {
  const { errors, submitCount, isValidating, isSubmitting } = useFormikContext()
  const lastHandled = useRef(0)

  useEffect(() => {
    if (submitCount === lastHandled.current) return
    const keys = Object.keys(errors)
    if (keys.length === 0) {
      // Valid submit — or errors not computed yet; they arrive as a dep change.
      if (!isValidating && !isSubmitting) lastHandled.current = submitCount
      return
    }
    lastHandled.current = submitCount
    const invoiceOnly = keys.every((key) => INVOICE_TAB_FIELDS.has(key))
    onJump(invoiceOnly ? 'invoice' : 'business')
  }, [submitCount, errors, isValidating, isSubmitting, onJump])

  return null
}

export function BusinessSettingsPage({ user, data }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { businesses, branches, activeBusinessId, refreshBusinesses, refreshScopedData } =
    data

  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const branch = branches.find((b) => b.isMainBranch) ?? branches[0] ?? null

  const [tab, setTab] = useState<SettingsTab>('business')
  // License plans unlock the first N receipt layouts (list order).
  const { maxTemplates } = useLicenseLimits()
  // Mirror of the device printer settings: the template picker and the live
  // preview need them, and ReceiptPrinterCard reports its saves up here.
  const [printerSettings, setPrinterSettings] = useState<PosPrinterSettings | null>(null)

  useEffect(() => {
    let alive = true
    window.api.printer.getSettings().then(
      (loaded) => {
        if (alive) setPrinterSettings(loaded)
      },
      () => {
        // ReceiptPrinterCard surfaces the failure; previews fall back to defaults.
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const saveTemplate = useCallback(
    async (template: PosReceiptTemplate) => {
      // Optimistic, mirroring ReceiptPrinterCard's save pattern.
      setPrinterSettings((prev) => (prev ? { ...prev, posTemplate: template } : prev))
      try {
        setPrinterSettings(await window.api.printer.setSettings({ posTemplate: template }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
        try {
          setPrinterSettings(await window.api.printer.getSettings())
        } catch {
          // Keep the optimistic state; nothing better to show.
        }
      }
    },
    [t, toast],
  )

  if (!actions.canEditBusiness) return null

  if (!business) {
    return (
      <div>
        <PageHeader
          eyebrow={t('dashboard.eyebrowSettings')}
          title={t('dashboard.businessSettings')}
          description={t('dashboard.businessSettingsDesc')}
        />
        <EmptyState title={t('empty.noBusinesses')} description={t('empty.noBusinessesDesc')} />
      </div>
    )
  }

  const canSave = actions.canEditBusiness
  const currencyOptions = currencyOptionsForValue(business.currency)
  const settingsSchema = buildSettingsSchema(business.currency)
  const activeTemplate = printerSettings?.posTemplate ?? 'classic'
  const activePaper = printerSettings?.posPaperWidth ?? '80mm'

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowSettings')}
        title={t('dashboard.businessSettings')}
        description={t('dashboard.businessSettingsDesc')}
      />

      <Tabs
        idBase="business-settings"
        items={[
          { id: 'business', label: t('forms.settingsTabBusiness') },
          { id: 'invoice', label: t('forms.settingsTabInvoice') },
        ]}
        value={tab}
        onValueChange={(id) => setTab(id as SettingsTab)}
        className="mb-5"
      />

      <Formik
        enableReinitialize
        initialValues={{
          name: business.name,
          currency: (business.currency || 'PKR').trim().toUpperCase(),
          brandColor: resolveBrandPresetHex(business.brandColor || DEFAULT_BRAND_COLOR),
          logoPath: business.logoPath,
          socialWhatsapp: denormalizeSocialLink(business.socialWhatsapp, 'whatsapp'),
          socialInstagram: denormalizeSocialLink(business.socialInstagram, 'instagram'),
          socialFacebook: denormalizeSocialLink(business.socialFacebook, 'facebook'),
          socialTiktok: denormalizeSocialLink(business.socialTiktok, 'tiktok'),
          socialWebsite: denormalizeSocialLink(business.socialWebsite, 'website'),
          branchName: branch?.name ?? '',
          branchAddress: branch?.address ?? '',
          branchPhone: branch?.phone ?? '',
          receiptHeader: business.receiptHeader ?? '',
          receiptFooter: business.receiptFooter ?? '',
        }}
        validationSchema={settingsSchema}
        onSubmit={async (values) => {
          if (!canSave) return
          try {
            if (actions.canEditBusiness) {
              await window.api.business.update({
                id: business.id,
                name: values.name,
                currency: values.currency,
                brandColor: values.brandColor,
                logoPath: values.logoPath,
                socialWhatsapp: normalizeSocialLink(values.socialWhatsapp, 'whatsapp'),
                socialInstagram: normalizeSocialLink(values.socialInstagram, 'instagram'),
                socialFacebook: normalizeSocialLink(values.socialFacebook, 'facebook'),
                socialTiktok: normalizeSocialLink(values.socialTiktok, 'tiktok'),
                socialWebsite: normalizeSocialLink(values.socialWebsite, 'website'),
                receiptHeader: values.receiptHeader.trim() || null,
                receiptFooter: values.receiptFooter.trim() || null,
              })
              useActiveBusinessStore.getState().setCurrency(values.currency)
              applyBrandTheme(values.brandColor)
            }
            if (actions.canEditBranch && branch) {
              await window.api.business.updateBranch({
                id: branch.id,
                name: values.branchName,
                address: values.branchAddress,
                phone: values.branchPhone,
              })
            }
            await refreshBusinesses()
            if (activeBusinessId) await refreshScopedData(activeBusinessId)
            toast.success(t('toast.businessUpdated'))
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          }
        }}
      >
        {({ values, setFieldValue, isSubmitting }) => {
          // Live preview follows the form as the user types (no hooks here —
          // this is a render prop; ReceiptEnginePreview debounces by content).
          const liveSample = buildReceiptSample(
            {
              businessName: values.name,
              currency: values.currency,
              brandColor: values.brandColor,
              logoPath: values.logoPath,
              branchAddress: values.branchAddress,
              branchPhone: values.branchPhone,
              receiptHeader: values.receiptHeader,
              receiptFooter: values.receiptFooter,
              socialWhatsapp: normalizeSocialLink(values.socialWhatsapp, 'whatsapp'),
              socialInstagram: normalizeSocialLink(values.socialInstagram, 'instagram'),
              socialFacebook: normalizeSocialLink(values.socialFacebook, 'facebook'),
              socialTiktok: normalizeSocialLink(values.socialTiktok, 'tiktok'),
              socialWebsite: normalizeSocialLink(values.socialWebsite, 'website'),
            },
            t,
          )

          return (
            <Form className="space-y-5">
              <TabErrorSync onJump={setTab} />

              {/* Both panels stay mounted (hidden, not unmounted): Formik
                  fields keep their state and the printer card doesn't refetch
                  on every tab switch. */}
              <div
                role="tabpanel"
                id="business-settings-panel-business"
                aria-labelledby="business-settings-tab-business"
                hidden={tab !== 'business'}
                className="space-y-5"
              >
                <Card title={t('forms.editBusiness')} description={t('forms.profileBrandingHint')}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormTextField name="name" label={t('forms.name')} disabled={!actions.canEditBusiness} />
                    <FormSelectField
                      name="currency"
                      label={t('forms.currency')}
                      options={currencyOptions}
                      disabled={!actions.canEditBusiness}
                    />
                  </div>
                  <div className="mt-5">
                    <ColorPickerField
                      label={t('forms.brandColor')}
                      value={values.brandColor}
                      applyLiveTheme={actions.canEditBusiness}
                      disabled={!actions.canEditBusiness}
                      onChange={(hex) => setFieldValue('brandColor', hex)}
                    />
                  </div>
                  <div className="mt-5 space-y-2">
                    <p className="text-sm font-medium text-ink">{t('forms.logo')}</p>
                    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line/80 bg-surface-muted/30 p-3">
                      {values.logoPath ? (
                        <img
                          src={assetSrc(values.logoPath) ?? undefined}
                          alt=""
                          className="h-16 w-auto max-w-[160px] rounded-lg border border-line bg-surface-raised object-contain p-2"
                        />
                      ) : (
                        <div className="grid h-16 w-36 place-items-center rounded-lg border border-dashed border-line bg-surface-raised text-sm text-ink-subtle">
                          {t('forms.noLogo')}
                        </div>
                      )}
                      {actions.canEditBusiness ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={async () => {
                              const picked = await window.api.assets.pickAndSave({ kind: 'logo' })
                              if (picked) setFieldValue('logoPath', picked.relativePath)
                            }}
                          >
                            {t('forms.chooseLogo')}
                          </Button>
                          {values.logoPath ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setFieldValue('logoPath', null)}
                            >
                              {t('forms.removeLogo')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <Card title={t('forms.socialLinks')} description={t('forms.socialLinksHint')}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormTextField
                      name="socialWhatsapp"
                      label={t('forms.socialWhatsapp')}
                      placeholder="03xx1234567"
                      disabled={!actions.canEditBusiness}
                    />
                    <FormTextField
                      name="socialInstagram"
                      label={t('forms.socialInstagram')}
                      placeholder="your_username"
                      disabled={!actions.canEditBusiness}
                    />
                    <FormTextField
                      name="socialFacebook"
                      label={t('forms.socialFacebook')}
                      placeholder="page_or_username"
                      disabled={!actions.canEditBusiness}
                    />
                    <FormTextField
                      name="socialTiktok"
                      label={t('forms.socialTiktok')}
                      placeholder="@your_username"
                      disabled={!actions.canEditBusiness}
                    />
                    <FormTextField
                      name="socialWebsite"
                      label={t('forms.socialWebsite')}
                      placeholder="yourdomain.com"
                      disabled={!actions.canEditBusiness}
                      containerClassName="sm:col-span-2"
                    />
                  </div>
                </Card>

                <Card title={t('forms.branchContact')}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormTextField
                      name="branchName"
                      label={t('forms.branch')}
                      disabled={!actions.canEditBranch}
                    />
                    <FormTextField
                      name="branchPhone"
                      label={t('forms.phone')}
                      disabled={!actions.canEditBranch}
                    />
                    <FormTextField
                      name="branchAddress"
                      label={t('forms.address')}
                      disabled={!actions.canEditBranch}
                      containerClassName="sm:col-span-2"
                    />
                  </div>
                </Card>

                {/* Device license & plan — self-contained, saves via its own
                    button (never submits this business form). */}
                <LicensePlanCard />
              </div>

              <div
                role="tabpanel"
                id="business-settings-panel-invoice"
                aria-labelledby="business-settings-tab-invoice"
                hidden={tab !== 'invoice'}
                className="space-y-5"
              >
                <Card title={t('forms.invoiceSettings')} description={t('forms.invoiceSettingsHint')}>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                    <div className="space-y-4">
                      <FormTextareaField
                        name="receiptHeader"
                        label={t('forms.receiptHeader')}
                        hint={t('forms.receiptHeaderHint')}
                        rows={3}
                        disabled={!actions.canEditBusiness}
                        placeholder={t('forms.receiptHeaderHint')}
                      />
                      <FormTextareaField
                        name="receiptFooter"
                        label={t('forms.receiptFooter')}
                        hint={t('forms.receiptFooterHint')}
                        rows={3}
                        disabled={!actions.canEditBusiness}
                        placeholder={t('forms.receiptFooterHint')}
                      />

                      <div>
                        <p className="mb-2 text-sm font-medium text-ink">
                          {t('printer.templateTitle')}
                        </p>
                        <div
                          role="radiogroup"
                          aria-label={t('printer.templateTitle')}
                          className="flex flex-wrap gap-2"
                        >
                          {RECEIPT_TEMPLATES.map((tpl, index) => {
                            const selected = tpl.id === activeTemplate
                            const locked =
                              Number.isFinite(maxTemplates) && index >= maxTemplates
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={locked}
                                onClick={() => void saveTemplate(tpl.id)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-pos',
                                  selected
                                    ? 'border-brand-primary bg-brand-primary text-brand-on-primary shadow-glow'
                                    : 'border-line/80 bg-surface-muted/30 text-ink-muted hover:border-brand-primary/50 hover:text-ink',
                                  locked && 'cursor-not-allowed opacity-50 hover:border-line/80 hover:text-ink-muted',
                                )}
                              >
                                {locked ? <Lock className="size-3.5" aria-hidden /> : null}
                                {t(tpl.labelKey)}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-xs text-ink-muted">
                          {t('printer.templateHint')}
                          {Number.isFinite(maxTemplates) &&
                          maxTemplates < RECEIPT_TEMPLATES.length
                            ? ` ${t('license.templatesLocked')}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="lg:sticky lg:top-3">
                      <p className="mb-2 text-sm font-medium text-ink">{t('forms.receiptPreview')}</p>
                      <ReceiptEnginePreview
                        template={activeTemplate}
                        paper={activePaper}
                        sample={liveSample}
                        fitWidth={300}
                        debounceMs={400}
                        className="mx-auto"
                      />
                    </div>
                  </div>
                </Card>

                {/* Device-level printer settings — saved per till, not part of
                    the business form (every control in the card is
                    type="button", so it cannot submit this Form). */}
                <ReceiptPrinterCard onSettingsSaved={setPrinterSettings} />
              </div>

              {canSave ? (
                <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-line/80 bg-surface-raised/95 px-4 py-3 shadow-lift backdrop-blur-md">
                  <p className="me-auto hidden text-sm text-ink-muted sm:block">
                    {t('forms.settingsSaveHint')}
                  </p>
                  <Button type="submit" loading={isSubmitting}>
                    {t('common.save')}
                  </Button>
                </div>
              ) : null}
            </Form>
          )
        }}
      </Formik>
    </div>
  )
}
