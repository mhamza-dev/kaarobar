import { Form, Formik } from 'formik'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '../../../components/ui'
import { FormTextField } from '../../../components/form'
import { licenseSchema, type LicenseFormValues } from '../../../schemas/setupSchemas'

type Props = {
  initial: LicenseFormValues
  loading: boolean
  error?: string
  onNext: (values: LicenseFormValues) => void
}

export function LicenseStep({ initial, loading, error, onNext }: Props) {
  const { t } = useTranslation()

  return (
    <Card title={t('setup.licenseTitle')} description={t('setup.licenseDesc')} accent="brand">
      <Formik<LicenseFormValues> initialValues={initial} validationSchema={licenseSchema} onSubmit={onNext}>
        {() => (
          <Form className="space-y-4">
            <FormTextField
              name="licenseKey"
              label={t('setup.licenseKey')}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
            />
            {error ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={loading} className="w-full">
              {t('setup.activateContinue')}
            </Button>
          </Form>
        )}
      </Formik>
    </Card>
  )
}
