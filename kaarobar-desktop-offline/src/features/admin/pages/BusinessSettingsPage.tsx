import { Form, Formik } from 'formik'
import { useTranslation } from 'react-i18next'
import { Button, Card, EmptyState, useToast } from '../../../components/ui'
import { FormTextField, FormSelectField, FormTextareaField } from '../../../components/form'
import { ColorPickerField } from '../../../components/form/ColorPickerField'
import { PageHeader } from '../../../components/layout'
import { businessCreateSchema, businessSettingsCurrencySchema } from '../../../schemas/adminSchemas'
import { DEFAULT_BRAND_COLOR, applyBrandTheme, resolveBrandPresetHex } from '../../../lib/theme'
import { useActionVisibility } from '../../../lib/nav'
import { assetSrc } from '../../../lib/assets'
import { currencyOptionsForValue } from '../../../../shared/currencies'
import { useActiveBusinessStore } from '../../../stores/activeBusinessStore'
import { InvoiceReceiptPreview } from '../components/InvoiceReceiptPreview'
import type { SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'
import * as yup from 'yup'

type Props = {
  user: SessionUser
  data: AdminData
}

const ensureHttps = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

const normalizeWhatsapp = (input: string) => {
  const digits = input.replace(/\D+/g, '')
  if (digits) return `https://wa.me/${digits}`
  return ensureHttps(input)
}

const normalizeSocialHandle = (
  input: string,
  baseUrl: string,
  { keepAt = false }: { keepAt?: boolean } = {},
) => {
  if (/^https?:\/\//i.test(input)) return input
  if (/^[\w.-]+\.[a-z]{2,}/i.test(input)) return ensureHttps(input)
  const clean = input.replace(/^@+/, '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null
  return `${baseUrl}${keepAt ? `@${clean}` : clean}`
}

const normalizeSocialLink = (
  input: string,
  type: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'website',
) => {
  const value = input.trim()
  if (!value) return null
  switch (type) {
    case 'whatsapp':
      return normalizeWhatsapp(value)
    case 'instagram':
      return normalizeSocialHandle(value, 'https://instagram.com/')
    case 'facebook':
      return normalizeSocialHandle(value, 'https://facebook.com/')
    case 'tiktok':
      return normalizeSocialHandle(value, 'https://tiktok.com/', { keepAt: true })
    case 'website':
      return ensureHttps(value)
    default:
      return value
  }
}

/** Strip stored absolute URLs so the form shows handle / phone / domain only. */
const denormalizeSocialLink = (
  input: string | null | undefined,
  type: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'website',
): string => {
  const value = (input ?? '').trim()
  if (!value) return ''

  try {
    if (type === 'whatsapp') {
      const digits = value.replace(/\D+/g, '')
      return digits || value
    }

    if (type === 'website') {
      return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    }

    const url = /^https?:\/\//i.test(value) ? new URL(value) : null
    const path = url ? url.pathname.replace(/^\/+|\/+$/g, '') : value.replace(/^@+/, '')

    if (type === 'tiktok') {
      const handle = path.replace(/^@+/, '')
      return handle ? `@${handle}` : ''
    }

    if (type === 'instagram' || type === 'facebook') {
      return path.split('/')[0] ?? path
    }
  } catch {
    return value
  }

  return value
}

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

export function BusinessSettingsPage({ user, data }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { businesses, branches, activeBusinessId, refreshBusinesses, refreshScopedData } =
    data

  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const branch = branches.find((b) => b.isMainBranch) ?? branches[0] ?? null

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

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowSettings')}
        title={t('dashboard.businessSettings')}
        description={t('dashboard.businessSettingsDesc')}
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
        {({ values, setFieldValue, isSubmitting }) => (
          <Form className="space-y-5">
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
                    placeholder={t('forms.receiptFooterDefault')}
                  />
                </div>
                <div className="lg:sticky lg:top-3">
                  <p className="mb-2 text-sm font-medium text-ink">{t('forms.receiptPreview')}</p>
                  <InvoiceReceiptPreview
                    businessName={values.name}
                    currency={values.currency}
                    brandColor={values.brandColor}
                    logoPath={values.logoPath}
                    branchAddress={values.branchAddress}
                    branchPhone={values.branchPhone}
                    receiptHeader={values.receiptHeader}
                    receiptFooter={values.receiptFooter}
                  />
                </div>
              </div>
            </Card>

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
        )}
      </Formik>
    </div>
  )
}
