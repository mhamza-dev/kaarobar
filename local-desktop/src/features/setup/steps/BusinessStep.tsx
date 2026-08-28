import { Form, Formik } from 'formik'
import { ArrowLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '../../../components/ui'
import { FormTextField, FormSelectField, ColorPickerField } from '../../../components/form'
import { businessSchema, type BusinessFormValues } from '../../../schemas/setupSchemas'
import { BUSINESS_NATURES } from '../../../lib/businessNature'
import { cn } from '../../../lib/cn'
import { currencyOptionsForValue } from '../../../../shared/currencies'

type Props = {
  initial: BusinessFormValues
  loading: boolean
  onBack: () => void
  onNext: (values: BusinessFormValues) => void
}

export function BusinessStep({ initial, loading, onBack, onNext }: Props) {
  const { t } = useTranslation()
  const currencyOptions = currencyOptionsForValue(initial.currency)

  return (
    <Card title={t('setup.businessTitle')} description={t('setup.businessDesc')} accent="brand">
      <Formik<BusinessFormValues>
        initialValues={initial}
        validationSchema={businessSchema}
        onSubmit={onNext}
      >
        {({ values, setFieldValue, errors, touched }) => (
          <Form className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormTextField name="name" label={t('setup.businessName')} />
              <FormSelectField
                name="currency"
                label={t('setup.currency')}
                options={currencyOptions}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t('setup.businessNature')}</p>
              <p className="text-xs text-ink-muted">{t('setup.businessNatureDesc')}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {BUSINESS_NATURES.map((nature) => {
                  const selected = values.businessNature === nature
                  return (
                    <button
                      key={nature}
                      type="button"
                      onClick={() => setFieldValue('businessNature', nature)}
                      className={cn(
                        'relative rounded-lg border px-3.5 py-3.5 text-start transition-[border-color,box-shadow,background-color,transform] duration-200',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/35',
                        selected
                          ? 'border-brand-primary/55 bg-gradient-to-br from-brand-tint/70 via-surface-raised/80 to-surface-raised shadow-soft ring-1 ring-brand-primary/20'
                          : 'border-line/80 bg-surface-raised/70 hover:-translate-y-0.5 hover:border-brand-primary/40 hover:bg-brand-tint/25',
                      )}
                    >
                      {selected ? (
                        <span className="absolute end-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-brand-primary text-brand-on-primary">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                      <p className="pe-6 text-sm font-semibold tracking-tight text-ink">
                        {t(`natures.${nature}.label`)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {t(`natures.${nature}.desc`)}
                      </p>
                    </button>
                  )
                })}
              </div>
              {touched.businessNature && errors.businessNature ? (
                <p className="text-xs text-danger">{errors.businessNature}</p>
              ) : null}
            </div>

            <ColorPickerField
              label={t('setup.brandColor')}
              value={values.brandColor}
              applyLiveTheme
              onChange={(hex) => setFieldValue('brandColor', hex)}
            />

            <div className="space-y-3 rounded-lg border border-line/60 bg-surface-muted/40 p-3.5">
              <FormTextField name="branchName" label={t('setup.branchName')} />
              <FormTextField name="branchAddress" label={t('setup.branchAddress')} />
              <FormTextField name="branchPhone" label={t('setup.branchPhone')} />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/30 pt-4 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start px-0 text-ink-muted hover:bg-transparent hover:text-ink hover:underline sm:w-auto"
                onClick={onBack}
                disabled={loading}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t('common.back')}
              </Button>
              <Button type="submit" loading={loading} className="w-full sm:ms-auto sm:w-auto sm:min-w-[10rem]">
                {t('common.continue')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Card>
  )
}
