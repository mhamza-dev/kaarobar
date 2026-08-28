import { useCallback, useEffect, useMemo, useState } from 'react'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Table,
  useToast,
} from '../../../components/ui'
import {
  FormCheckbox,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from '../../../components/form'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import type { HappyHourPriceRule, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
}

type FormValues = {
  name: string
  scope: 'all' | 'product'
  productId: string
  pricing: 'override' | 'percent'
  overridePrice: number | ''
  percentOff: number | ''
  weekdaysMask: number
  startTime: string
  endTime: string
  priority: number | ''
  isActive: boolean
}

const WEEKDAY_BITS = [
  { bit: 1, key: 'mon' },
  { bit: 2, key: 'tue' },
  { bit: 4, key: 'wed' },
  { bit: 8, key: 'thu' },
  { bit: 16, key: 'fri' },
  { bit: 32, key: 'sat' },
  { bit: 64, key: 'sun' },
] as const

export function HappyHourPage({ user, data }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const licenseFeatures = useLicenseFeatures()
  const { activeBusinessId, products } = data
  const [rules, setRules] = useState<HappyHourPriceRule[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HappyHourPriceRule | null>(null)

  const refresh = useCallback(async () => {
    if (!activeBusinessId) return
    try {
      setRules(await window.api.happyHour.list(activeBusinessId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }, [activeBusinessId, t, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const schema = useMemo(
    () =>
      Yup.object({
        name: Yup.string().trim().required(t('happyHour.nameRequired')),
        scope: Yup.mixed<'all' | 'product'>().oneOf(['all', 'product']).required(),
        productId: Yup.string().when('scope', {
          is: 'product',
          then: (s) => s.required(t('happyHour.productRequired')),
          otherwise: (s) => s.strip(),
        }),
        pricing: Yup.mixed<'override' | 'percent'>().oneOf(['override', 'percent']).required(),
        overridePrice: Yup.mixed().when('pricing', {
          is: 'override',
          then: () => Yup.number().min(0).required(),
          otherwise: () => Yup.mixed().nullable(),
        }),
        percentOff: Yup.mixed().when('pricing', {
          is: 'percent',
          then: () => Yup.number().min(0).max(100).required(),
          otherwise: () => Yup.mixed().nullable(),
        }),
        weekdaysMask: Yup.number().min(1).required(),
        startTime: Yup.string().required(),
        endTime: Yup.string().required(),
        priority: Yup.number().required(),
        isActive: Yup.boolean(),
      }),
    [t],
  )

  const initialValues: FormValues = editing
    ? {
        name: editing.name,
        scope: editing.productId ? 'product' : 'all',
        productId: editing.productId ?? '',
        pricing: editing.overridePrice != null ? 'override' : 'percent',
        overridePrice: editing.overridePrice ?? '',
        percentOff: editing.percentOff ?? '',
        weekdaysMask: editing.weekdaysMask || 127,
        startTime: editing.startTime,
        endTime: editing.endTime,
        priority: editing.priority,
        isActive: editing.isActive,
      }
    : {
        name: '',
        scope: 'all',
        productId: '',
        pricing: 'percent',
        overridePrice: '',
        percentOff: 10,
        weekdaysMask: 127,
        startTime: '16:00',
        endTime: '19:00',
        priority: 0,
        isActive: true,
      }

  if (!actions.canViewProducts) return null
  if (!hasLicenseFeature(licenseFeatures, 'happy_hour')) return null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('dashboard.eyebrowHappyHour')}
        title={t('dashboard.happyHour')}
        description={t('dashboard.happyHourDesc')}
        actions={
          actions.canEditProducts ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              {t('happyHour.add')}
            </Button>
          ) : null
        }
      />

      {rules.length === 0 ? (
        <EmptyState title={t('happyHour.emptyTitle')} description={t('happyHour.emptyDesc')} />
      ) : (
        <Card className="overflow-hidden !p-0">
          <Table
            columns={[
              {
                key: 'name',
                header: t('happyHour.name'),
                render: (row) => row.name,
              },
              {
                key: 'window',
                header: t('happyHour.window'),
                render: (row) => `${row.startTime}–${row.endTime}`,
              },
              {
                key: 'price',
                header: t('happyHour.pricing'),
                render: (row) =>
                  row.overridePrice != null
                    ? formatMoney(row.overridePrice)
                    : t('happyHour.percentOff', { n: row.percentOff ?? 0 }),
              },
              {
                key: 'priority',
                header: t('happyHour.priority'),
                render: (row) => row.priority,
              },
              {
                key: 'status',
                header: t('common.active'),
                render: (row) => (
                  <Badge>{row.isActive ? t('common.active') : t('common.inactive')}</Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (row) =>
                  actions.canEditProducts ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(row)
                        setOpen(true)
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                  ) : null,
              },
            ]}
            rows={rules}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('happyHour.edit') : t('happyHour.add')}
        size="lg"
      >
        <Formik<FormValues>
          initialValues={initialValues}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            if (!activeBusinessId) return
            try {
              const payload = {
                name: values.name.trim(),
                productId: values.scope === 'product' ? values.productId : null,
                categoryId: null as string | null,
                overridePrice: values.pricing === 'override' ? Number(values.overridePrice) : null,
                percentOff: values.pricing === 'percent' ? Number(values.percentOff) : null,
                weekdaysMask: Number(values.weekdaysMask),
                startTime: values.startTime,
                endTime: values.endTime,
                priority: Number(values.priority) || 0,
                isActive: values.isActive,
              }
              if (editing) {
                await window.api.happyHour.update({ id: editing.id, ...payload })
              } else {
                await window.api.happyHour.create({ businessId: activeBusinessId, ...payload })
              }
              toast.success(t('toast.profileUpdated'))
              setOpen(false)
              await refresh()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            } finally {
              helpers.setSubmitting(false)
            }
          }}
        >
          {({ values, setFieldValue, isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormTextField name="name" label={t('happyHour.name')} />
              <FormSelectField
                name="scope"
                label={t('happyHour.scope')}
                options={[
                  { value: 'all', label: t('happyHour.scopeAll') },
                  { value: 'product', label: t('happyHour.scopeProduct') },
                ]}
              />
              {values.scope === 'product' ? (
                <FormSelectField
                  name="productId"
                  label={t('forms.product')}
                  options={products
                    .filter((p) => p.isActive)
                    .map((p) => ({ value: p.id, label: p.name }))}
                />
              ) : null}
              <FormSelectField
                name="pricing"
                label={t('happyHour.pricing')}
                options={[
                  { value: 'percent', label: t('happyHour.pricingPercent') },
                  { value: 'override', label: t('happyHour.pricingOverride') },
                ]}
              />
              {values.pricing === 'override' ? (
                <FormNumberField name="overridePrice" label={t('happyHour.overridePrice')} />
              ) : (
                <FormNumberField name="percentOff" label={t('happyHour.percent')} />
              )}
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_BITS.map(({ bit, key }) => {
                  const on = (Number(values.weekdaysMask) & bit) !== 0
                  return (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={on ? 'primary' : 'secondary'}
                      onClick={() => {
                        const current = Number(values.weekdaysMask) || 0
                        void setFieldValue('weekdaysMask', on ? current & ~bit : current | bit)
                      }}
                    >
                      {t(`happyHour.day.${key}`)}
                    </Button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormTextField name="startTime" label={t('happyHour.startTime')} />
                <FormTextField name="endTime" label={t('happyHour.endTime')} />
              </div>
              <FormNumberField name="priority" label={t('happyHour.priority')} />
              <FormCheckbox name="isActive" label={t('common.active')} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t('common.save')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  )
}
